"""Live research demonstration. Creates an unapproved candidate, never publishes a part."""
import json
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
base = "https://rqc76xf3-8000.jpe1.devtunnels.ms"
key = next(iter(json.loads((ROOT / "config/local-api-keys.json").read_text(encoding="utf-8"))))


def rpc(name, arguments):
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
    request = urllib.request.Request(base + "/mcp", data=json.dumps(payload).encode(), headers={"X-API-Key": key, "Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    result = json.load(urllib.request.urlopen(request, timeout=40))["result"]
    if result.get("isError"):
        raise RuntimeError(result["content"])
    return json.loads(result["content"][0]["text"])


job = rpc("ResearchComponent", {"model": "LM358", "manufacturer": "Texas Instruments"})
print("Research job:", job["id"], flush=True)
for _ in range(45):
    job = rpc("GetJobStatus", {"job_id": job["id"]})
    if job["status"] not in ("queued", "running"):
        break
    time.sleep(2)
assert job["status"] == "completed", job
candidate = rpc("GetComponentCandidate", {"candidate_id": job["result"]["candidate_id"]})
assert candidate["status"] == "pending_review"
report = {"mcp_url": base + "/mcp", "job": job, "candidate": candidate, "approved": False}
output = ROOT / "outputs/research-live-check.json"
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("Candidate:", candidate["id"], "status:", candidate["status"], "sources:", len(candidate["analyses"]), flush=True)
print("Saved report:", output.name)
