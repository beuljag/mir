"""기존 SKILL.md를 같은 이름의 Copilot 기술 ZIP에 반영한다. 별도 묶음은 만들지 않는다."""
import argparse
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ('circuit-coordinator', 'component-research', 'circuit-design',
          'validation-interpretation', 'component-image')


def package(source):
    data = source.read_text(encoding='utf-8-sig').replace('\r\n', '\n').encode('utf-8')
    lines = data.decode('utf-8').splitlines()
    if not lines or lines[0] != '---' or f'name: {source.parent.name}' not in lines:
        raise ValueError(f'기술 원본 형식을 확인하세요: {source}')
    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        item = ZipInfo('SKILL.md')
        item.compress_type = ZIP_DEFLATED
        archive.writestr(item, data)
    return data, output.getvalue()


def main(check=False):
    folder = ROOT / 'outputs' / 'copilot-agent-setup'
    for name in AGENTS:
        source = folder / name / 'SKILL.md'
        destination = folder / f'{name}-skill.zip'
        source_data, payload = package(source)
        if check:
            with ZipFile(destination) as archive:
                if archive.namelist() != ['SKILL.md'] or archive.read('SKILL.md') != source_data or archive.testzip():
                    raise ValueError(f'원본과 ZIP이 다릅니다: {destination}')
            print(f'OK: {destination.name}')
        elif not destination.exists() or destination.read_bytes() != payload:
            destination.write_bytes(payload)
            print(f'UPDATED: {destination.name}')
        else:
            print(f'UNCHANGED: {destination.name}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='수정 없이 ZIP과 기존 원본의 일치만 확인')
    main(parser.parse_args().check)
