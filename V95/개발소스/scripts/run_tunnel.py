"""Host the configured persistent Dev Tunnel on Windows or Linux."""
import argparse
from contextlib import contextmanager
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import subprocess
import sys
from tempfile import NamedTemporaryFile
import time
from urllib.parse import urlsplit
from urllib.request import urlopen

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def tunnel_settings():
    path = ROOT / "config" / "tunnel.json"
    saved = json.loads(path.read_text(encoding="utf-8-sig")) if path.is_file() else {}
    values = {**dotenv_values(ROOT / ".env", encoding="utf-8-sig", interpolate=False), **os.environ}
    tunnel_id = (values.get("DEVTUNNEL_ID") or saved.get("tunnel_id") or "").strip()
    public_url = (values.get("DEVTUNNEL_PUBLIC_URL") or saved.get("public_url") or "").strip()
    token = (values.get("DEVTUNNEL_HOST_TOKEN") or "").strip()
    url = urlsplit(public_url)
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", tunnel_id):
        raise ValueError("Set DEVTUNNEL_ID in .env or tunnel_id in config/tunnel.json.")
    if (url.scheme != "https" or not url.hostname or url.username is not None or url.password is not None
            or url.path not in ("", "/") or url.query or url.fragment):
        raise ValueError("Set DEVTUNNEL_PUBLIC_URL to the public HTTPS base URL.")
    if re.search(r"\s", token):
        raise ValueError("DEVTUNNEL_HOST_TOKEN must be a single token.")
    return tunnel_id, public_url.rstrip("/"), token


def tunnel_executable():
    windows = os.name == "nt"
    command = "devtunnel.exe" if windows else "devtunnel"
    bundled = ROOT / "tools" / command
    if bundled.is_file():
        return bundled
    installed = shutil.which(command)
    if installed:
        return Path(installed)
    if platform.machine().lower() not in ("amd64", "x86_64"):
        raise RuntimeError("Install the Microsoft Dev Tunnels CLI for this architecture and add it to PATH.")
    bundled.parent.mkdir(parents=True, exist_ok=True)
    target = "win-x64" if windows else "linux-x64"
    print("[INFO] Downloading Microsoft Dev Tunnels CLI...", flush=True)
    with NamedTemporaryFile(dir=bundled.parent, delete=False) as download:
        temporary = Path(download.name)
    try:
        with urlopen(f"https://aka.ms/TunnelsCliDownload/{target}", timeout=30) as response, temporary.open("wb") as output:
            shutil.copyfileobj(response, output)
        if not windows:
            temporary.chmod(0o755)
        temporary.replace(bundled)
        return bundled
    finally:
        temporary.unlink(missing_ok=True)


@contextmanager
def tunnel_lock(path):
    with path.open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            lock.seek(0, 2)
            if lock.tell() == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            acquire = lambda: msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            acquire = lambda: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            acquire()
        except OSError:
            yield False
        else:
            yield True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--settings", action="store_true", help="Print only the tunnel ID and public URL")
    parser.add_argument("--prepare", action="store_true", help="Check settings and locate or install the tunnel CLI")
    args = parser.parse_args()
    tunnel_id, public_url, _ = tunnel_settings()
    if args.settings:
        print(json.dumps({"tunnel_id": tunnel_id, "public_url": public_url}))
        return
    if args.prepare:
        tunnel_executable()
        return

    logs = ROOT / "logs"
    logs.mkdir(exist_ok=True)
    logger = logging.getLogger("circuit.tunnel")
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(logs / "tunnel.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    with tunnel_lock(logs / "tunnel.lock") as owned:
        if not owned:
            logger.info("Tunnel launcher already running; duplicate exited.")
            return
        executable = tunnel_executable()
        signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
        while True:
            tunnel_id, _, token = tunnel_settings()
            command = [str(executable), "host", tunnel_id, "--host-header", "localhost:8000",
                       "--origin-header", "http://localhost:8000"]
            if token:
                command.extend(("--access-token", "-"))
            child_env = {key: value for key, value in os.environ.items() if key != "DEVTUNNEL_HOST_TOKEN"}
            logger.info("Starting saved tunnel %s", tunnel_id)
            child = subprocess.Popen(command, cwd=ROOT, env=child_env,
                                     stdin=subprocess.PIPE if token else subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                if token:
                    try:
                        child.stdin.write(token + "\n")
                        child.stdin.close()
                    except BrokenPipeError:
                        pass
                for line in child.stdout:
                    logger.info("%s", line.rstrip().replace(token, "[redacted]") if token else line.rstrip())
                code = child.wait()
                logger.warning("Tunnel exited (%s). Retrying in 60 seconds. Check host authorization.", code)
            finally:
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait()
            time.sleep(60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as exc:
        import traceback
        (ROOT / "logs").mkdir(exist_ok=True)
        with (ROOT / "logs" / "tunnel-startup-error.log").open("a", encoding="utf-8") as error_log:
            traceback.print_exc(file=error_log)
        if sys.stderr is not None:
            print(str(exc), file=sys.stderr)
        sys.exit(1)
