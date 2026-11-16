"""가져온 KiCad 프로젝트만 검사한다. 미르 DB 회로의 통과 상태를 대신 갱신하지 않는다."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import threading
import time
from uuid import uuid4

from fastapi import Depends
from fastapi.responses import JSONResponse

from .local_connection import env_settings
from .models import JobRecord, KiCadChecks, KiCadImport
from .research import now

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'.kicad_sch', '.kicad_pro', '.lib', '.inc', '.mod', '.cir', '.sp', '.model'}
MAX_TOTAL = 16_000_000


class VerificationError(ValueError):
    def __init__(self, code, status=422):
        self.code, self.status = code, status
        super().__init__(code)


def file_name(name):
    if not isinstance(name, str) or not re.fullmatch(r'[\w .()+/-]{1,200}', name):
        raise VerificationError('INVALID_PROJECT_PATH')
    path = PurePosixPath(name)
    if path.is_absolute() or any(p in ('', '.', '..') for p in name.split('/')) or path.suffix.lower() not in ALLOWED:
        raise VerificationError('INVALID_PROJECT_PATH')
    return path.as_posix()


def project_reference(value, source, files):
    value = value.replace('${KIPRJMOD}/', '').replace('\\', '/')
    relative = file_name((PurePosixPath(source).parent / value).as_posix())
    if relative not in files:
        raise VerificationError('REFERENCED_FILE_NOT_UPLOADED')
    return relative


def inspect_schematic(text, source, files):
    if not text.lstrip().startswith('(kicad_sch') or '\x00' in text:
        raise VerificationError('INVALID_KICAD_SCHEMATIC')
    # 문자열 안의 괄호는 무시한다. 과도한 중첩이나 잘린 파일을 외부 프로그램에 보내지 않는다.
    depth = 0
    for token in re.finditer(r'"(?:\\.|[^"\\])*"|[()]', text):
        if token.group() == '(':
            depth += 1
        elif token.group() == ')':
            depth -= 1
        if depth < 0 or depth > 128:
            raise VerificationError('INVALID_KICAD_NESTING')
    if depth:
        raise VerificationError('INVALID_KICAD_SCHEMATIC')
    for match in re.finditer(r'\(property\s+"Sheetfile"\s+("(?:\\.|[^"\\])*")', text, re.I):
        try:
            project_reference(json.loads(match[1]), source, files)
        except (ValueError, TypeError):
            raise VerificationError('INVALID_SHEET_REFERENCE') from None


def run_program(arguments, cwd, log, timeout=60):
    """셸 없이 실행하며 출력·시간·Windows 메모리를 제한한다. 비밀 환경 변수는 전달하지 않는다."""
    allowed = {'SYSTEMROOT', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMDATA', 'USERPROFILE'}
    environment = {k: v for k, v in os.environ.items() if k.upper() in allowed or k.upper().startswith('KICAD')}
    handle = None
    with log.open('wb') as output:
        process = subprocess.Popen(arguments, cwd=cwd, stdin=subprocess.DEVNULL, stdout=output,
                                   stderr=subprocess.STDOUT, env=environment, shell=False,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            if os.name == 'nt':
                import win32api
                import win32job
                handle = win32job.CreateJobObject(None, 'CircuitVerify-' + uuid4().hex)
                limits = win32job.QueryInformationJobObject(handle, win32job.JobObjectExtendedLimitInformation)
                limits['BasicLimitInformation']['LimitFlags'] = win32job.JOB_OBJECT_LIMIT_PROCESS_MEMORY | win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                limits['ProcessMemoryLimit'] = 1024 * 1024 * 1024
                win32job.SetInformationJobObject(handle, win32job.JobObjectExtendedLimitInformation, limits)
                ph = win32api.OpenProcess(0x0100 | 0x0001, False, process.pid)
                try:
                    win32job.AssignProcessToJobObject(handle, ph)
                finally:
                    ph.Close()
            end = time.monotonic() + timeout
            while process.poll() is None:
                if time.monotonic() > end:
                    raise VerificationError('VERIFICATION_TIMEOUT', 504)
                if log.stat().st_size > 5_000_000 or sum(p.stat().st_size for p in cwd.rglob('*') if p.is_file()) > 32_000_000:
                    raise VerificationError('VERIFICATION_OUTPUT_LIMIT')
                time.sleep(.1)
            if log.stat().st_size > 5_000_000:
                raise VerificationError('VERIFICATION_OUTPUT_LIMIT')
            return process.returncode
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=5)
            if handle:
                handle.Close()


def sanitize_spice(text, files, source='export.cir', stack=(), library=False, cleaned_files=None):
    """모델은 업로드한 텍스트 파일만 참조한다. 제어 언어·파일 입출력·동적 코드 로드는 거부한다."""
    if len(text.encode('utf-8')) > 5_000_000 or len(stack) > 8 or source in stack or '\x00' in text:
        raise VerificationError('SPICE_INPUT_LIMIT')
    cleaned_files = {} if cleaned_files is None else cleaned_files
    output = []
    lines = text.splitlines()
    if not library and lines:
        lines = lines[1:]  # SPICE 첫 줄은 제목이다.
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('*'):
            continue
        if re.search(r'\.control\b|\.endc\b|\b(?:shell|system|osdi|pre_osdi|codemodel|sourcepath|filesource|d_source)\b|\b(?:file|filename)\s*=', stripped, re.I):
            raise VerificationError('SPICE_UNSAFE_COMMAND')
        if re.search(r'[\x00-\x08\x0b-\x1f`!;]', stripped):
            raise VerificationError('SPICE_UNSAFE_COMMAND')
        directive = stripped.split()[0].lower()
        if directive in ('.include', '.inc', '.lib'):
            match = re.fullmatch(r'\.(?:include|inc|lib)\s+(?:"([^"\n]+)"|\x27([^\x27\n]+)\x27|(\S+))(?:\s+([A-Za-z0-9_-]+))?', stripped, re.I)
            if not match:
                raise VerificationError('SPICE_INVALID_INCLUDE')
            value = next(g for g in match.groups()[:3] if g is not None)
            if directive == '.lib' and not match[4] and '/' not in value and '.' not in value:
                output.append(stripped)  # 모형 라이브러리 내부의 섹션 선언.
                continue
            name = project_reference(value, source, files)
            cleaned = sanitize_spice(files[name], files, name, stack + (source,), library=True, cleaned_files=cleaned_files)
            cleaned_files[name] = cleaned
            output.append(f'{directive} "{name}"' + (' ' + match[4] if match[4] else ''))
        elif directive in ('.op', '.tran', '.ac', '.dc', '.save', '.print', '.plot', '.probe', '.meas', '.measure', '.end', '.title'):
            continue  # 실제 분석 종류와 출력은 명시적인 요청 설정으로 생성한다.
        elif directive.startswith('.') and directive not in ('.model', '.subckt', '.ends', '.param', '.func', '.global', '.ic', '.nodeset', '.temp', '.endl'):
            raise VerificationError('SPICE_DIRECTIVE_UNSUPPORTED')
        elif not directive.startswith('.') and directive[0].upper() not in 'RCLVIDQMXBFEGHSKTOW+':
            raise VerificationError('SPICE_DEVICE_UNSUPPORTED')
        else:
            output.append(stripped)
    if not library:
        files.update(cleaned_files)
    return '\n'.join(output) + '\n'


def erc_result(report, exit_code):
    if not isinstance(report, dict) or not isinstance(report.get('sheets', report.get('violations')), list):
        raise VerificationError('INVALID_ERC_REPORT')
    violations = []
    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get('violations'), list):
                violations.extend(v for v in value['violations'] if isinstance(v, dict))
            for key, item in value.items():
                if key != 'violations':
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
    visit(report)
    active = [v for v in violations if not v.get('excluded')]
    errors = sum(v.get('severity') == 'error' for v in active)
    warnings = sum(v.get('severity') == 'warning' for v in active)
    unknown = any(v.get('severity') not in ('error', 'warning', 'info') for v in active)
    status = 'failed' if errors else 'warning' if warnings else 'passed' if exit_code == 0 and not unknown else 'unknown'
    return {'status': status, 'errors': errors, 'warnings': warnings, 'excluded': len(violations) - len(active),
            'violations': active[:200], 'truncated': len(active) > 200, 'exit_code': exit_code}


def spice_tables(text):
    tables = []
    current = None
    for line in text.splitlines():
        words = line.split()
        if words and words[0] == 'Index' and len(words) > 1:
            current = {'columns': words[1:], 'rows': [], 'truncated': False}
            tables.append(current)
        elif current and words and words[0].isdigit() and len(words) == len(current['columns']) + 1:
            try:
                row = [float(v) for v in words[1:]]
                if all(math.isfinite(v) for v in row):
                    if len(current['rows']) < 2000:
                        current['rows'].append(row)
                    else:
                        current['truncated'] = True
            except ValueError:
                pass
    return tables[:20]


class KiCadService:
    def __init__(self, store, root=ROOT, runner=run_program):
        self.store, self.root, self.runner = store, root, runner
        self.folder = Path(store.path).parent / 'verification'
        self.folder.mkdir(parents=True, exist_ok=True)
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='kicad-verification')
        self.slots = threading.BoundedSemaphore(3)

    def executable(self, kind):
        value = env_settings(self.root).get('KICAD_CLI_PATH' if kind == 'kicad' else 'NGSPICE_PATH')
        if value:
            return str(Path(value).resolve()) if Path(value).is_file() else None
        name = 'kicad-cli' if kind == 'kicad' else 'ngspice'
        found = shutil.which(name)
        if not found and kind == 'kicad':
            candidates = sorted(Path('C:/Program Files/KiCad').glob('*/bin/kicad-cli.exe'), reverse=True)
            found = str(candidates[0]) if candidates else None
        return found

    def config(self):
        return {'kicad_available': bool(self.executable('kicad')), 'ngspice_available': bool(self.executable('ngspice')),
                'input': 'imported_kicad_schematic', 'analyses': ['op', 'transient'], 'max_upload_bytes': MAX_TOTAL,
                'message': 'KiCad와 ngspice 실행 파일 경로는 서버의 .env에 지정합니다.'}

    def project(self, project_id, owner):
        record = self.store.get_kicad_project(project_id, owner)
        if not record:
            raise VerificationError('KICAD_PROJECT_NOT_FOUND', 404)
        return record

    def import_project(self, body, owner):
        files = {file_name(item.name): item.content for item in body.files}
        main = file_name(body.main_file)
        if len(files) != len(body.files) or len({p.casefold() for p in files}) != len(files):
            raise VerificationError('DUPLICATE_PROJECT_FILE')
        if main not in files or not main.lower().endswith('.kicad_sch'):
            raise VerificationError('MAIN_SCHEMATIC_REQUIRED')
        sizes = [len(v.encode('utf-8')) for v in files.values()]
        if sum(sizes) > MAX_TOTAL or any(size > 5_000_000 for size in sizes):
            raise VerificationError('PROJECT_UPLOAD_TOO_LARGE', 413)
        for name, content in files.items():
            if name.lower().endswith('.kicad_sch'):
                inspect_schematic(content, name, files)
            elif name.lower().endswith('.kicad_pro'):
                try:
                    json.loads(content)
                except ValueError:
                    raise VerificationError('INVALID_KICAD_PROJECT_JSON') from None
        record = {'id': uuid4().hex, 'name': body.name, 'main_file': main, 'created_at': now(),
                  'files': [{'name': name, 'bytes': len(content.encode('utf-8')), 'sha256': hashlib.sha256(content.encode('utf-8')).hexdigest()} for name, content in files.items()]}
        folder = self.folder / record['id'] / 'source'
        folder.mkdir(parents=True)
        for name, content in files.items():
            path = folder / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
        self.store.save_kicad_project(record, owner)
        return record

    def submit(self, project_id, body, owner):
        record = self.project(project_id, owner)
        if not self.slots.acquire(blocking=False):
            raise VerificationError('VERIFICATION_QUEUE_FULL', 429)
        job = JobRecord(id=str(uuid4()), kind='kicad_verification', status='queued', created_at=now(), updated_at=now(),
                        result={'project_id': record['id'], 'source': 'imported_file', 'checks': body.model_dump()})
        try:
            self.store.save_job(job, owner, create=True)
            self.pool.submit(self.execute, job.model_copy(deep=True), record, body, owner)
        except Exception:
            self.slots.release()
            raise
        return job

    def execute(self, job, project, checks, owner):
        work = None
        try:
            job.status, job.updated_at = 'running', now()
            self.store.save_job(job, owner)
            work = self.folder / project['id'] / job.id
            work.mkdir()
            files = {}
            for item in project['files']:
                content = (self.folder / project['id'] / 'source' / item['name']).read_text(encoding='utf-8')
                if hashlib.sha256(content.encode('utf-8')).hexdigest() != item['sha256']:
                    raise VerificationError('PROJECT_FILE_CHANGED')
                files[item['name']] = content
                path = work / item['name']
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding='utf-8')
            main = str((work / project['main_file']).resolve())
            kicad, ngspice = self.executable('kicad'), self.executable('ngspice')
            result = job.result
            result['erc'] = {'status': 'not_requested'}
            result['ngspice'] = {'status': 'not_requested'}
            if checks.run_erc:
                if not kicad:
                    result['erc'] = {'status': 'unavailable', 'code': 'KICAD_CLI_NOT_FOUND'}
                else:
                    erc_path = work / 'erc.json'
                    rc = self.runner([kicad, 'sch', 'erc', '--format', 'json', '--severity-all', '--exit-code-violations', '--output', str(erc_path.resolve()), main], work, work / 'erc.log')
                    if rc not in (0, 5) or not erc_path.is_file() or erc_path.stat().st_size > 5_000_000:
                        result['erc'] = {'status': 'failed', 'code': 'KICAD_ERC_FAILED', 'exit_code': rc}
                    else:
                        result['erc'] = erc_result(json.loads(erc_path.read_text(encoding='utf-8-sig')), rc)
            if checks.run_ngspice:
                if not kicad or not ngspice:
                    result['ngspice'] = {'status': 'unavailable', 'code': 'KICAD_CLI_NOT_FOUND' if not kicad else 'NGSPICE_NOT_FOUND'}
                else:
                    netlist = work / 'export.cir'
                    rc = self.runner([kicad, 'sch', 'export', 'netlist', '--format', 'spice', '--output', str(netlist.resolve()), main], work, work / 'export.log')
                    if rc or not netlist.is_file() or netlist.stat().st_size > 5_000_000:
                        result['ngspice'] = {'status': 'failed', 'code': 'SPICE_EXPORT_FAILED', 'exit_code': rc}
                    else:
                        try:
                            cleaned = sanitize_spice(netlist.read_text(encoding='utf-8-sig'), files)
                            for name, content in files.items():
                                if Path(name).suffix.lower() in ('.lib', '.inc', '.mod', '.cir', '.sp', '.model'):
                                    (work / name).write_text(content, encoding='utf-8')
                            vectors = list(checks.vectors)
                            if not vectors:
                                nodes = re.findall(r'^[RCLVID]\S*\s+([\w/.:+-]+)\s+([\w/.:+-]+)', cleaned, re.M | re.I)
                                vectors = [f'v({n})' for n in dict.fromkeys(n for pair in nodes for n in pair if n != '0')][:8]
                            if not vectors:
                                raise VerificationError('SPICE_PROBE_REQUIRED')
                            analysis = '.op' if checks.analysis == 'op' else f'.tran {checks.timestep:g} {checks.duration:g}'
                            probe = '.print ' + ('op' if checks.analysis == 'op' else 'tran') + ' ' + ' '.join(vectors)
                            (work / 'run.cir').write_text('* Imported KiCad schematic; API-selected analysis\n' + cleaned + '\n' + analysis + '\n' + probe + '\n.end\n', encoding='utf-8')
                            rc = self.runner([ngspice, '-b', '-n', 'run.cir'], work, work / 'ngspice.log')
                            log = (work / 'ngspice.log').read_text(encoding='utf-8', errors='replace')
                            failed = rc != 0 or bool(re.search(r'(?im)^\s*(?:fatal\b|error\b|doanalyses:|simulation interrupted)|unknown subckt|no such vector|no simulations run', log))
                            tables = spice_tables(log)
                            result['ngspice'] = {'status': 'failed' if failed else 'completed' if any(t['rows'] for t in tables) else 'unknown',
                                                 'exit_code': rc, 'analysis': checks.analysis, 'vectors': vectors, 'tables': tables,
                                                 'scope': '지정 모델의 수치 계산 결과이며 실제 하드웨어 안전성 판정은 아닙니다.'}
                        except VerificationError as exc:
                            result['ngspice'] = {'status': 'unsupported', 'code': exc.code}
            statuses = [result['erc']['status'], result['ngspice']['status']]
            result['status'] = 'failed' if 'failed' in statuses else 'unknown' if any(s in statuses for s in ('unknown', 'unavailable', 'unsupported')) else 'completed'
            result['artifacts'] = [p.name for p in work.iterdir() if p.name in ('erc.json', 'erc.log', 'export.cir', 'export.log', 'run.cir', 'ngspice.log') and p.is_file()]
            result['note'] = '가져온 파일의 검사 결과입니다. 미르 DB 회로의 검증 상태나 실제 부품 안전성을 자동 승인하지 않습니다.'
            job.status = 'completed'
        except Exception as exc:
            job.status = 'failed'
            job.error = {'code': exc.code if isinstance(exc, VerificationError) else 'VERIFICATION_FAILED',
                         'message': '파일, 실행 파일, 모델 경로 또는 프로그램 로그를 확인하세요.'}
        finally:
            job.updated_at = now()
            if work and work.is_dir():
                job.result['artifacts'] = [p.name for p in work.iterdir() if p.name in ('erc.json', 'erc.log', 'export.cir', 'export.log', 'run.cir', 'ngspice.log') and p.is_file()]
            self.store.save_job(job, owner)
            self.slots.release()


def attach_kicad_verification(app, store, owner, root=ROOT):
    app.state.verification = KiCadService(store, root)

    @app.exception_handler(VerificationError)
    async def error(request, exc):
        return JSONResponse({'detail': {'code': exc.code}}, status_code=exc.status)

    @app.get('/verification/config', operation_id='GetCircuitVerificationConfig', tags=['verification'])
    def config(user: str = Depends(owner)):
        return app.state.verification.config()

    @app.post('/verification/projects', status_code=201, operation_id='ImportKiCadProject', tags=['verification'])
    def upload(body: KiCadImport, user: str = Depends(owner)):
        return app.state.verification.import_project(body, user)

    @app.get('/verification/projects/{project_id}', operation_id='GetKiCadProject', tags=['verification'])
    def project(project_id: str, user: str = Depends(owner)):
        return app.state.verification.project(project_id, user)

    @app.post('/verification/projects/{project_id}/verify', status_code=202, operation_id='VerifyKiCadProject', tags=['verification'])
    def verify(project_id: str, body: KiCadChecks, user: str = Depends(owner)):
        return app.state.verification.submit(project_id, body, user)

    @app.get('/verification/jobs/{job_id}/artifacts/{name}', tags=['verification'])
    def artifact(job_id: str, name: str, user: str = Depends(owner)):
        job = store.get_job(job_id, user)
        if not job or job.kind != 'kicad_verification' or not job.result or name not in job.result.get('artifacts', []):
            raise VerificationError('ARTIFACT_NOT_FOUND', 404)
        path = app.state.verification.folder / job.result['project_id'] / job.id / name
        if not path.is_file() or path.stat().st_size > 5_000_000:
            raise VerificationError('ARTIFACT_NOT_FOUND', 404)
        return {'name': name, 'text': path.read_text(encoding='utf-8-sig', errors='replace')}
