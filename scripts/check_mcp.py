"""Verify the deployed MCP protocol without displaying the API key."""
import argparse
import json
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def verify(base_url):
    key = next(iter(json.loads((ROOT / "config" / "local-api-keys.json").read_text(encoding="utf-8"))))
    endpoint = base_url.rstrip("/") + "/mcp"

    def rpc(method, params=None, authenticated=True):
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if authenticated:
            headers["X-API-Key"] = key
        request = urllib.request.Request(endpoint, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}).encode(), headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
        if "error" in data:
            raise RuntimeError(data["error"])
        return data["result"]

    try:
        rpc("tools/list", authenticated=False)
        raise AssertionError("Unauthenticated MCP request was accepted")
    except urllib.error.HTTPError as exc:
        assert exc.code == 401, exc.code
    rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "circuit-connection-check", "version": "1"}})
    tools = rpc("tools/list")["tools"]
    result = rpc("tools/call", {"name": "GetComponentDetails", "arguments": {"component_id": "virtual-sensor"}})
    assert not result.get("isError"), result
    names = sorted(t["name"] for t in tools)
    assert {"SearchComponents", "GetComponentDetails", "CreateComponent", "CreateCircuitDraft", "GetCircuitStatus", "UpdateCircuit", "ValidateCircuit", "ApplyCircuitLayout", "ResearchComponent", "AnalyzeDatasheet", "GetJobStatus", "GetComponentCandidate", "ListComponentCandidates", "GetComponentImageSpec", "SaveComponentSvg", "GetImageGenerationConfig", "GenerateComponentImage", "GetComponentImage", "ListComponentImages", "ApplyComponentImage"}.issubset(names), names
    return {"endpoint": endpoint, "authentication_required": True, "tools": names, "sample_call": "GetComponentDetails: OK"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    print(json.dumps(verify(args.url), ensure_ascii=False, indent=2))
