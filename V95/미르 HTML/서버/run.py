import argparse
from pathlib import Path
import socket
import sys
import traceback

ROOT = Path(__file__).resolve().parent


def main(background=False):
    log_config = None
    if background:
        logs = ROOT / "logs"
        logs.mkdir(exist_ok=True)
        # pythonw has no console streams. Capture startup failures without exposing keys.
        sys.stdout = sys.stderr = (logs / "startup.log").open("a", encoding="utf-8", buffering=1)
        log_config = {
            "version": 1, "disable_existing_loggers": False,
            "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
            "handlers": {"file": {"class": "logging.handlers.RotatingFileHandler",
                                   "filename": str(logs / "server.log"), "maxBytes": 2_000_000,
                                   "backupCount": 3, "encoding": "utf-8", "formatter": "plain"}},
            "loggers": {name: {"handlers": ["file"], "level": "INFO", "propagate": False}
                        for name in ("uvicorn", "uvicorn.error", "uvicorn.access")},
        }
    import uvicorn
    from app.main import create_app

    # Bind first: a duplicate launcher exits without starting a second server.
    listeners = []
    try:
        for port in (8000, 8002):
            listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            listeners.append(listener)
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            listener.bind(("127.0.0.1", port))
            listener.listen(128)
    except OSError as exc:
        for item in listeners:
            item.close()
        if exc.errno == 10048:
            print(f"Port {port} is already in use. Existing process was left running.")
            return
        raise
    try:
        options = {"log_config": log_config} if background else {}
        server = uvicorn.Server(uvicorn.Config(create_app(), host="127.0.0.1", port=8000, **options))
        server.run(sockets=listeners)
    finally:
        for listener in listeners:
            listener.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", action="store_true")
    args = parser.parse_args()
    try:
        main(args.background)
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
