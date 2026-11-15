import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

KEY_A = "mcp-user-a-test-key-123456789"
KEY_B = "mcp-user-b-test-key-123456789"
HEADERS = {"X-API-Key": KEY_A, "Accept": "application/json, text/event-stream"}


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(str(tmp_path / "mcp.db"), {KEY_A: "a", KEY_B: "b"}), headers=HEADERS) as client:
        yield client


def rpc(client, method, params=None, headers=None):
    response = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def tool(client, name, arguments, headers=None):
    result = rpc(client, "tools/call", {"name": name, "arguments": arguments}, headers)["result"]
    return result


def data(result):
    assert not result.get("isError"), result
    return json.loads(result["content"][0]["text"])


def test_initialize_and_discover_seven_tools(client):
    init = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}})
    assert init["result"]["serverInfo"]["name"] == "Circuit Agent"
    tools = rpc(client, "tools/list")["result"]["tools"]
    assert {t["name"] for t in tools} == {"ReportChatProgress", "GetCircuitVerificationConfig", "ImportKiCadProject", "GetKiCadProject", "VerifyKiCadProject", "SearchComponents", "GetComponentDetails", "CreateComponent", "FillComponentPinVoltage", "CreateCircuitDraft", "GetCircuitStatus", "UpdateCircuit", "ValidateCircuit", "ApplyCircuitLayout", "ResearchComponent", "AnalyzeDatasheet", "GetJobStatus", "GetComponentCandidate", "ListComponentCandidates", "GetImageGenerationConfig", "GenerateComponentImage", "ListComponentImages", "GetComponentImage", "ApplyComponentImage", "GetComponentImageSpec", "SaveComponentSvg", "ImportFritzingArtwork", "ImportArduinoCadArtwork"}
    for t in tools:
        assert "ctx" not in t["inputSchema"].get("properties", {})
        for schema in (t["inputSchema"], t.get("outputSchema", {})):
            serialized = json.dumps(schema)
            assert '"$ref"' not in serialized and '"$defs"' not in serialized
            assert '"exclusiveMinimum"' not in serialized


def test_mcp_auth_and_host_protection(client):
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    assert client.post("/mcp", json=body, headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.post("/mcp", json=body, headers={"Host": "untrusted.example"}).status_code == 421


def test_mcp_full_lifecycle_and_owner_isolation(client):
    search = tool(client, "SearchComponents", {"q": "sensor"})
    assert not search.get("isError") and "virtual-sensor" in str(search)
    assert data(tool(client, "GetComponentDetails", {"component_id": "virtual-sensor"}))["is_virtual"]
    draft = json.loads((Path(__file__).resolve().parents[1] / "examples" / "sample-circuit.json").read_text(encoding="utf-8"))
    created = data(tool(client, "CreateCircuitDraft", {"draft_json": json.dumps(draft)}))
    cid = created["id"]
    assert created["version"] == 1
    assert data(tool(client, "GetCircuitStatus", {"circuit_id": cid}))["id"] == cid
    assert data(tool(client, "ValidateCircuit", {"circuit_id": cid, "expected_version": 1}))["status"] == "unknown"
    assert tool(client, "ApplyCircuitLayout", {"circuit_id": cid, "expected_version": 1}).get("isError")
    assert data(tool(client, "ApplyCircuitLayout", {"circuit_id": cid, "expected_version": 1, "allow_unvalidated_draft": True}))["version"] == 1
    other = tool(client, "GetCircuitStatus", {"circuit_id": cid}, {"X-API-Key": KEY_B})
    assert other.get("isError") and "404" in str(other)
    updated = data(tool(client, "UpdateCircuit", {"circuit_id": cid, "update_json": json.dumps({**draft, "expected_version": 1})}))
    assert updated["version"] == 2 and updated["validation_result"] is None
    stale = tool(client, "ValidateCircuit", {"circuit_id": cid, "expected_version": 1})
    assert stale.get("isError") and "409" in str(stale)


def test_mcp_rejects_invalid_json_without_writes(client):
    result = tool(client, "CreateCircuitDraft", {"draft_json": "not JSON"})
    assert result.get("isError") and "INVALID_CIRCUIT_JSON" in str(result)


@pytest.mark.parametrize("direction", ["power_in", "bidirectional"])
def test_mcp_fills_missing_pin_voltage_and_keeps_existing_circuit(client, direction):
    def create(model, pins):
        return data(tool(client, "CreateComponent", {"component_json": json.dumps({
            "request_id": "voltage-" + model, "model": model, "manufacturer": "Test", "category": "board", "pins": pins
        })}))
    supply = create("fixture-supply", [{"id": "OUT/5V", "label": "5V", "direction": "power_out", "signal_type": "power"}])
    sensor = create("fixture-input", [{"id": "VCC", "label": "VCC", "direction": direction, "signal_type": "power",
                                      "voltage_max": 3.3}])
    payload = {"name": "voltage fixture",
               "component_instances": [{"instance_id": "U1", "component_definition_id": supply["id"]},
                                       {"instance_id": "S1", "component_definition_id": sensor["id"]}],
               "nets": [{"net_id": "power", "connected_pin_refs": [{"instance_id": "U1", "pin_id": "OUT/5V"},
                                                                  {"instance_id": "S1", "pin_id": "VCC"}]}]}
    circuit = data(tool(client, "CreateCircuitDraft", {"draft_json": json.dumps(payload)}))
    check = {"circuit_id": circuit["id"], "expected_version": 1}
    assert "MISSING_OUTPUT_VOLTAGE" in {i["code"] for i in data(tool(client, "ValidateCircuit", check))["issues"]}
    args = {"component_id": supply["id"], "pin_id": "OUT/5V"}
    fields = {"output_voltage": 5, "source_url": "https://manufacturer.example/board", "source_title": "Board fixture",
              "evidence": "OUT/5V supplies 5 V."}
    def fill(value, headers=None):
        return tool(client, "FillComponentPinVoltage", {**args, "voltage_json": json.dumps({**fields, "output_voltage": value})}, headers)
    assert fill(5, {"X-API-Key": KEY_B}).get("isError")
    saved = data(fill(5))
    assert saved["id"] == supply["id"] and saved["pins"][0]["output_voltage"] == 5
    assert saved["source_references"][0]["reference"] == fields["source_url"]
    assert data(fill(5)) == saved
    assert "PIN_VOLTAGE_ALREADY_SET" in str(fill(3.3))
    verified = data(tool(client, "ValidateCircuit", check))
    assert verified["status"] == "failed"
    assert "VOLTAGE_OUT_OF_RANGE" in {i["code"] for i in verified["issues"]}
    assert "MISSING_OUTPUT_VOLTAGE" not in {i["code"] for i in verified["issues"]}
