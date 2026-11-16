"""환경 변수 검증. 비밀값과 운영 데이터는 변경하지 않는다."""
import os
from pathlib import Path


def cloud_mode():
    mode = os.getenv("MIR_DEPLOYMENT", "")
    if mode not in ("", "railway"):
        raise RuntimeError("MIR_DEPLOYMENT는 미설정 또는 railway만 지원합니다.")
    return mode == "railway"


def bind_config():
    cloud = cloud_mode()
    # cloud에서는 기존 HOST 값에 의존하지 않고 공개 인터페이스에 바인딩한다.
    host = "0.0.0.0" if cloud else (os.getenv("HOST") or "127.0.0.1")
    value = os.getenv("PORT") or "8000"
    if not value.isascii() or not value.isdigit() or not 1 <= int(value) <= 65535:
        raise RuntimeError("PORT 환경 변수는 1~65535의 정수여야 합니다.")
    if not host or any(c.isspace() or c in "/@?#" for c in host):
        raise RuntimeError("HOST 환경 변수에 올바른 바인딩 주소가 필요합니다.")
    return host, int(value)


def database_path(root, override=None):
    cloud = cloud_mode()
    selected = override or os.getenv("CIRCUIT_DB_PATH") or str(Path(root) / "data" / "circuits.db")
    if cloud:
        if not os.getenv("CIRCUIT_DB_PATH"):
            raise RuntimeError("CIRCUIT_DB_PATH 환경 변수가 필요합니다. /data/circuits.db처럼 볼륨 안의 경로를 설정하세요.")
        volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
        if not volume:
            raise RuntimeError("RAILWAY_VOLUME_MOUNT_PATH가 없습니다. 기존 Railway Volume 연결을 확인하세요.")
        path = Path(selected)
        mount = Path(volume)
        if not path.is_absolute() or not mount.is_absolute() or not mount.is_dir():
            raise RuntimeError("CIRCUIT_DB_PATH와 Railway Volume의 절대 경로·마운트 상태를 확인하세요.")
        if path.resolve() == mount.resolve() or not path.resolve().is_relative_to(mount.resolve()):
            raise RuntimeError("CIRCUIT_DB_PATH는 연결된 Railway Volume 안의 파일이어야 합니다.")
    return str(selected)
