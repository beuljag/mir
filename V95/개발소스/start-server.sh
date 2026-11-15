#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ $# -gt 1 || (${1:-} != "" && ${1:-} != "--no-tunnel") ]]; then
    printf '%s\n' 'Usage: bash start-server.sh [--no-tunnel]' >&2
    exit 2
fi
if ! command -v python3 >/dev/null; then
    printf '%s\n' 'Install Python 3.11+ and its venv package, then run again.' >&2
    exit 1
fi
python3 scripts/bootstrap_server.py
python=.venv/bin/python
if [[ ! -f config/local-api-keys.json ]]; then
    "$python" scripts/setup_local_key.py
fi
if [[ ${1:-} != --no-tunnel ]]; then
    settings=$("$python" scripts/run_tunnel.py --settings)
    "$python" scripts/run_tunnel.py --prepare
    public_url=$(printf '%s' "$settings" | "$python" -c 'import json,sys; print(json.load(sys.stdin)["public_url"])')
fi

api_pid=
tunnel_pid=
cleanup() {
    trap - EXIT
    if [[ -n $tunnel_pid ]]; then kill "$tunnel_pid" 2>/dev/null || true; fi
    if [[ -n $api_pid ]]; then kill "$api_pid" 2>/dev/null || true; fi
    wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$python" run.py --background &
api_pid=$!
if ! "$python" - "$api_pid" <<'PY'
import json
import os
import sys
import time
from urllib.request import urlopen

for _ in range(30):
    try:
        os.kill(int(sys.argv[1]), 0)
    except ProcessLookupError:
        break
    try:
        with urlopen("http://127.0.0.1:8000/health", timeout=1) as response:
            if json.load(response).get("status") == "ok":
                sys.exit(0)
    except (OSError, ValueError):
        pass
    time.sleep(0.5)
sys.exit("FastAPI could not start. Check logs/startup.log and ports 8000/8002.")
PY
then
    exit 1
fi
printf '%s\n' '[OK] Editor: http://127.0.0.1:8000/mir/'
if [[ ${1:-} == --no-tunnel ]]; then
    wait "$api_pid"
else
    "$python" scripts/run_tunnel.py &
    tunnel_pid=$!
    printf '%s\n' "[INFO] Starting tunnel for $public_url/mir/ (logs/tunnel.log)"
    "$python" - "$public_url" <<'PY'
import json
import sys
import time
from urllib.request import Request, urlopen

for _ in range(15):
    try:
        check = Request(sys.argv[1] + "/health", headers={"Accept": "application/json"})
        with urlopen(check, timeout=3) as response:
            if json.load(response).get("status") == "ok":
                print("[OK] Public MCP: " + sys.argv[1] + "/mcp")
                break
    except (OSError, ValueError):
        pass
    time.sleep(1)
else:
    sys.exit("Public tunnel is not responding. Check logs/tunnel.log and DEVTUNNEL_HOST_TOKEN.")
PY
    wait -n "$api_pid" "$tunnel_pid"
fi
