"""Prepare this checkout's server virtual environment without starting services."""
import hashlib
from pathlib import Path
import os
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 11):
        sys.exit("Python 3.11+ is required. Install Python and run the launcher again.")
    env_dir = ROOT / ".venv"
    python = env_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        print("[INFO] Creating the server virtual environment...", flush=True)
        venv.EnvBuilder(with_pip=True).create(env_dir)
    requirements = ROOT / "requirements.txt"
    stamp = env_dir / ".mir-server-requirements"
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    if stamp.is_file() and stamp.read_text(encoding="ascii") == digest:
        return
    print("[INFO] Installing server dependencies...", flush=True)
    install = [str(python), "-m", "pip", "install", "--disable-pip-version-check"]
    wheels = ROOT / "work" / "wheels"
    if wheels.is_dir():
        install.extend(("--no-index", "--find-links", str(wheels)))
    subprocess.run([*install, "-r", str(requirements)], cwd=ROOT, check=True)
    stamp.write_text(digest, encoding="ascii")


if __name__ == "__main__":
    main()
