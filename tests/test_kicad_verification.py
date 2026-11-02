import json
from pathlib import Path
import sys
import time

from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.kicad_verification import VerificationError, erc_result, run_program, sanitize_spice, spice_tables

KEY = 'kicad-owner-test-key-1234567890'
OTHER = 'kicad-other-test-key-1234567890'
SCHEMATIC = '(kicad_sch (version 20250114) (generator "fixture"))'


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / 'verification.db'), {KEY: 'a', OTHER: 'b'})
    with TestClient(app, headers={'X-API-Key': KEY}) as c:
        yield c
    app.state.research.pool.shutdown(wait=True)
    app.state.images.pool.shutdown(wait=True)
    app.state.verification.pool.shutdown(wait=True)


def upload(client, files=None):
    body = {'name': 'KiCad 합성 테스트', 'main_file': 'main.kicad_sch',
            'files': files or [{'name': 'main.kicad_sch', 'content': SCHEMATIC}]}
    response = client.post('/verification/projects', json=body)
    assert response.status_code == 201, response.text
    return response.json()


def finish(client, job):
    for _ in range(100):
        response = client.get('/jobs/' + job['id'])
        result = response.json()
        if result['status'] not in ('queued', 'running'):
            return result
        time.sleep(.01)
    raise AssertionError('검증 작업이 끝나지 않았습니다.')


def mock_program(arguments, cwd, log, timeout=60):
    # 실제 KiCad/ngspice 실행을 가장하지 않는 합성 프로그램 응답.
    log.write_text('Synthetic process log', encoding='utf-8')
    if 'erc' in arguments:
        Path(arguments[arguments.index('--output') + 1]).write_text(json.dumps({'sheets': [{'violations': []}]}), encoding='utf-8')
    elif 'netlist' in arguments:
        Path(arguments[arguments.index('--output') + 1]).write_text('* Synthetic circuit\nV1 in 0 10\nR1 in out 1k\nR2 out 0 1k\n.end\n', encoding='utf-8')
    else:
        assert '-b' in arguments and '-n' in arguments
        assert '.op' in (cwd / 'run.cir').read_text(encoding='utf-8')
        log.write_text('Index v(out)\n0 5.000000e+00\n', encoding='utf-8')
    return 0


def test_import_erc_simulation_job_results_and_owner_isolation(client):
    project = upload(client)
    pid = project['id']
    service = client.app.state.verification
    service.executable = lambda kind: 'fixture-' + kind
    service.runner = mock_program
    result = client.post(f'/verification/projects/{pid}/verify', json={'run_ngspice': True, 'vectors': ['v(out)']})
    assert result.status_code == 202
    job = finish(client, result.json())
    assert job['status'] == 'completed', job
    assert job['kind'] == 'kicad_verification'
    assert job['result']['erc']['status'] == 'passed'
    assert job['result']['ngspice']['status'] == 'completed'
    assert job['result']['ngspice']['tables'][0]['rows'] == [[5.0]]
    assert '미르 DB 회로' in job['result']['note']
    log = client.get(f"/verification/jobs/{job['id']}/artifacts/ngspice.log")
    assert log.status_code == 200 and 'Index' in log.json()['text']
    for path in [f'/verification/projects/{pid}', f"/jobs/{job['id']}", f"/verification/jobs/{job['id']}/artifacts/ngspice.log"]:
        assert client.get(path, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.post(f'/verification/projects/{pid}/verify', json={}, headers={'X-API-Key': OTHER}).status_code == 404
    assert client.get('/verification/config', headers={'X-API-Key': ''}).status_code == 401
    assert service.store.get_kicad_project(pid, 'a')['main_file'] == 'main.kicad_sch'


def test_missing_programs_returns_unavailable_not_passed(client):
    service = client.app.state.verification
    service.executable = lambda kind: None
    project = upload(client)
    job = finish(client, client.post(f"/verification/projects/{project['id']}/verify", json={'run_ngspice': True}).json())
    assert job['status'] == 'completed'
    assert job['result']['status'] == 'unknown'
    assert job['result']['erc']['code'] == 'KICAD_CLI_NOT_FOUND'
    assert job['result']['ngspice']['status'] == 'unavailable'


@pytest.mark.parametrize('name', ['../main.kicad_sch', 'C:/secret.kicad_sch', '/tmp/main.kicad_sch', 'models/../../secret.lib', '.spiceinit', 'main.cmd'])
def test_rejects_traversal_and_executable_uploads(client, name):
    result = client.post('/verification/projects', json={'name': 'bad', 'main_file': name, 'files': [{'name': name, 'content': SCHEMATIC}]})
    assert result.status_code == 422


def test_missing_child_and_duplicate_paths_rejected(client):
    text = '(kicad_sch (sheet (property "Sheetfile" "child.kicad_sch")))'
    result = client.post('/verification/projects', json={'name': 'child missing', 'main_file': 'main.kicad_sch', 'files': [{'name': 'main.kicad_sch', 'content': text}]})
    assert result.status_code == 422
    result = client.post('/verification/projects', json={'name': 'duplicate', 'main_file': 'main.kicad_sch', 'files': [
        {'name': 'main.kicad_sch', 'content': SCHEMATIC}, {'name': 'MAIN.kicad_sch', 'content': SCHEMATIC}]})
    assert result.status_code == 422


@pytest.mark.parametrize('content', [
    '* unsafe\n.control\nshell echo bad\n.endc\n.end',
    '* unsafe\n.include "../.env"\n.end',
    '* unsafe\n.pre_osdi arbitrary.dll\n.end',
    '* unsafe\nA1 input output filemodel\n.end',
    '* unsafe\nV1 a 0 pwl(file="secret")\n.end',
    '* unsafe\n.write /tmp/output\n.end',
])
def test_unsafe_spice_control_file_io_and_dynamic_code_rejected(content):
    with pytest.raises(VerificationError):
        sanitize_spice(content, {})


def test_uploaded_model_includes_supported_and_recursive_include_rejected():
    files = {'models/diode.lib': '.model TEST D(Is=1e-9)\n'}
    result = sanitize_spice('* title\n.include "models/diode.lib"\nV1 a 0 1\nD1 a 0 TEST\n.end', files)
    assert '.include "models/diode.lib"' in result
    with pytest.raises(VerificationError):
        sanitize_spice('* title\n.include "loop.lib"', {'loop.lib': '.include "loop.lib"\n'})


def test_erc_errors_warnings_unknown_report_and_empty_numeric_output():
    report = {'sheets': [{'violations': [{'severity': 'error', 'description': 'fixture conflict'}, {'severity': 'warning', 'description': 'fixture warning'}]}]}
    assert erc_result(report, 5)['status'] == 'failed'
    assert erc_result({'violations': [{'severity': 'mystery'}]}, 0)['status'] == 'unknown'
    with pytest.raises(VerificationError):
        erc_result({}, 0)
    assert spice_tables('no numeric output') == []
    assert spice_tables('Index time v(out)\n0 0.0 5.0\n1 0.1 nan')[0]['rows'] == [[0.0, 5.0]]


def test_mcp_import_and_verify_are_discoverable_and_work(client):
    def tool(name, args):
        result = client.post('/mcp', headers={'Accept': 'application/json, text/event-stream'}, json={
            'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': args}}).json()['result']
        assert not result.get('isError'), result
        return json.loads(result['content'][0]['text'])
    client.app.state.verification.executable = lambda kind: None
    project = tool('ImportKiCadProject', {'project_json': json.dumps({'name': 'fixture', 'main_file': 'main.kicad_sch', 'files': [{'name': 'main.kicad_sch', 'content': SCHEMATIC}]})})
    assert tool('GetKiCadProject', {'project_id': project['id']})['id'] == project['id']
    assert tool('GetCircuitVerificationConfig', {})['kicad_available'] is False
    job = tool('VerifyKiCadProject', {'project_id': project['id']})
    assert finish(client, job)['result']['erc']['status'] == 'unavailable'


def test_limits_and_probe_injection_rejected(client):
    pid = upload(client)['id']
    for checks in [{'run_erc': False, 'run_ngspice': False}, {'vectors': ['v(out)\n.control']},
                   {'analysis': 'transient', 'timestep': 1e-12, 'duration': 10}]:
        assert client.post(f'/verification/projects/{pid}/verify', json=checks).status_code == 422


def test_runner_uses_arguments_and_times_out_own_child(tmp_path):
    log = tmp_path / 'run.log'
    assert run_program([sys.executable, '-c', 'print("fixture")'], tmp_path, log, timeout=10) == 0
    assert 'fixture' in log.read_text(encoding='utf-8')
    with pytest.raises(VerificationError, match='VERIFICATION_TIMEOUT'):
        run_program([sys.executable, '-c', 'import time; time.sleep(5)'], tmp_path, log, timeout=.1)
