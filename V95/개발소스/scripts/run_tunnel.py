"""Windows sign-in launcher for the saved persistent Dev Tunnel."""
import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    import msvcrt
    logs = ROOT / "logs"
    logs.mkdir(exist_ok=True)
    logger = logging.getLogger("circuit.tunnel")
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(logs / "tunnel.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    lock = (logs / "tunnel.lock").open("a+b")
    lock.seek(0, 2)
    if lock.tell() == 0:
        lock.write(b"0")
        lock.flush()
    lock.seek(0)
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        logger.info("Tunnel launcher already running; duplicate exited.")
        lock.close()
        return
    executable = ROOT / "tools" / "devtunnel.exe"
    config = json.loads((ROOT / "config" / "tunnel.json").read_text(encoding="utf-8"))
    command = [str(executable), "host", config["tunnel_id"], "--host-header", "localhost:8000", "--origin-header", "http://localhost:8000"]
    child = None
    try:
        while True:
            logger.info("Starting saved tunnel %s", config["tunnel_id"])
            child = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                     creationflags=subprocess.CREATE_NO_WINDOW)
            for line in child.stdout:
                logger.info("%s", line.rstrip())
            code = child.wait()
            logger.warning("Tunnel exited (%s). Retrying in 60 seconds. Re-login may be required.", code)
            time.sleep(60)
    finally:
        if child and child.poll() is None:
            child.terminate()
            child.wait(timeout=10)
        lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
        lock.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        (ROOT / "logs").mkdir(exist_ok=True)
        with (ROOT / "logs" / "tunnel-startup-error.log").open("a", encoding="utf-8") as error_log:
            traceback.print_exc(file=error_log)
        sys.exit(1)
