from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import ComponentDefinition, Pin
from app.storage import Store

KEY = "test-key-for-user-a-123456789"
KEY_B = "test-key-for-user-b-123456789"


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(str(tmp_path / "test.db"), {KEY: "a", KEY_B: "b"})) as c:
        c.headers["X-API-Key"] = KEY
        yield c


@pytest.fixture
def draft():
    def refs(*pairs):
        return [{"instance_id": i, "pin_id": p} for i, p in pairs]
    return {"name": "virtual test", "component_instances": [
        {"instance_id": "P", "component_definition_id": "virtual-supply"},
        {"instance_id": "S", "component_definition_id": "virtual-sensor"},
        {"instance_id": "U", "component_definition_id": "virtual-controller"}],
        "nets": [{"net_id": "power", "connected_pin_refs": refs(("P", "VOUT"), ("S", "VCC"), ("U", "VCC"))},
                 {"net_id": "gnd", "connected_pin_refs": refs(("P", "GND"), ("S", "GND"), ("U", "GND"))},
                 {"net_id": "signal", "connected_pin_refs": refs(("S", "OUT"), ("U", "IN"))}], "layout": []}


def create(client, draft):
    response = client.post("/circuits", json=draft)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def check(client, cid, version=1):
    return client.post(f"/circuits/{cid}/validate", json={"expected_version": version})


def test_auth_and_component_search(client):
    assert client.get("/health").status_code == 200
    assert client.get("/components/search", headers={"X-API-Key": "bad"}).status_code == 401
    parts = client.get("/components/search?q=SENSOR").json()
    assert len(parts) == 1 and parts[0]["is_virtual"]
    assert client.get("/components/virtual-sensor").status_code == 200
    assert client.get("/components/missing").status_code == 404


def test_virtual_is_unknown_and_draft_apply_requires_opt_in(client, draft):
    cid = create(client, draft)
    result = check(client, cid).json()
    assert result["status"] == "unknown"
    assert not [i for i in result["issues"] if i["severity"] == "error"]
    assert client.post(f"/circuits/{cid}/apply", json={"expected_version": 1}).status_code == 409
    assert client.post(f"/circuits/{cid}/apply", json={"expected_version": 1, "allow_unvalidated_draft": True}).status_code == 200
    assert client.get(f"/circuits/{cid}").json()["applied_version"] == 1


def test_owner_isolation(client, draft):
    cid = create(client, draft)
    for method, path, body in [("GET", "", None), ("PUT", "", {**draft, "expected_version": 1}),
                               ("POST", "/validate", {"expected_version": 1}), ("POST", "/apply", {"expected_version": 1})]:
        assert client.request(method, f"/circuits/{cid}{path}", json=body, headers={"X-API-Key": KEY_B}).status_code == 404


def test_update_conflict_and_reset(client, draft):
    cid = create(client, draft)
    check(client, cid)
    result = client.put(f"/circuits/{cid}", json={**draft, "expected_version": 1})
    assert result.status_code == 200
    assert result.json()["version"] == 2 and result.json()["validation_result"] is None
    assert client.put(f"/circuits/{cid}", json={**draft, "expected_version": 1}).status_code == 409
    assert check(client, cid).status_code == 409
    assert check(client, cid, 2).status_code == 200


@pytest.mark.parametrize("mutation,code", [
    ("short", "POWER_GROUND_SHORT"), ("missing", "REQUIRED_PIN_UNCONNECTED"),
    ("unknown", "UNKNOWN_PIN"), ("duplicate_net", "PIN_IN_MULTIPLE_NETS"),
    ("drivers", "MULTIPLE_DRIVERS"), ("unknown_component", "UNKNOWN_COMPONENT")])
def test_electrical_faults(client, draft, mutation, code):
    if mutation == "short":
        draft["nets"][0]["connected_pin_refs"].append({"instance_id": "P", "pin_id": "GND"})
    elif mutation == "missing":
        draft["nets"].pop()
    elif mutation == "unknown":
        draft["nets"][2]["connected_pin_refs"][1]["pin_id"] = "FAKE"
    elif mutation == "duplicate_net":
        draft["nets"].append({"net_id": "other", "connected_pin_refs": deepcopy(draft["nets"][2]["connected_pin_refs"])})
    elif mutation == "drivers":
        draft["nets"][0]["connected_pin_refs"].append({"instance_id": "S", "pin_id": "OUT"})
    else:
        draft["component_instances"][0]["component_definition_id"] = "does-not-exist"
    result = check(client, create(client, draft)).json()
    assert result["status"] == "failed"
    assert code in {i["code"] for i in result["issues"]}


def test_input_validation_and_future_features(client, draft):
    draft["component_instances"].append(deepcopy(draft["component_instances"][0]))
    assert client.post("/circuits", json=draft).status_code == 422
    # Research is now a real queued job, not the previous unsupported placeholder.
    assert client.post("/components/research", json={"model": "anything"}).status_code == 202


def test_persistence_and_atomic_compare_and_swap(tmp_path, draft):
    path = str(tmp_path / "persist.db")
    app = create_app(path, {KEY: "a"})
    with TestClient(app, headers={"X-API-Key": KEY}) as c:
        cid = create(c, draft)
    with TestClient(create_app(path, {KEY: "a"}), headers={"X-API-Key": KEY}) as c:
        assert c.get(f"/circuits/{cid}").status_code == 200
        assert c.post(f"/circuits/{cid}/simulate", json={"expected_version": 1}).status_code == 501
    from app.storage import VersionConflict
    store = Store(path)
    one, stale = store.get(cid, "a"), store.get(cid, "a")
    one.version = 2
    store.save(one, "a", 1)
    stale.version = 2
    with pytest.raises(VersionConflict):
        store.save(stale, "a", 1)


def test_engine_pass_and_voltage_failure():
    from app.models import CircuitRecord
    from app.validation import validate
    # Test-only verified metadata exercises the engine; never inserted into the shipped DB.
    definitions = {"source": ComponentDefinition(id="source", manufacturer="fixture", model="fixture", revision="1", category="test", is_virtual=False, verification_status="verified", pins=[Pin(id="P", label="P", direction="power_out", signal_type="power", output_voltage=3.3)]),
                   "sink": ComponentDefinition(id="sink", manufacturer="fixture", model="fixture", revision="1", category="test", is_virtual=False, verification_status="verified", pins=[Pin(id="P", label="P", direction="power_in", signal_type="power", required=True, voltage_min=3, voltage_max=3.6)])}
    circuit = CircuitRecord(id="test", version=1, name="test", component_instances=[{"instance_id": "A", "component_definition_id": "source"}, {"instance_id": "B", "component_definition_id": "sink"}], nets=[{"net_id": "power", "connected_pin_refs": [{"instance_id": "A", "pin_id": "P"}, {"instance_id": "B", "pin_id": "P"}]}])
    assert validate(circuit, definitions).status == "passed"
    definitions["source"].pins[0].output_voltage = 5
    result = validate(circuit, definitions)
    assert result.status == "failed"
    assert "VOLTAGE_OUT_OF_RANGE" in {i.code for i in result.issues}


def test_openapi_operation_ids(client):
    spec = client.get("/openapi.json").json()
    ops = {op["operationId"] for path in spec["paths"].values() for op in path.values()}
    assert {"GetComponentDetails", "SearchComponents", "CreateCircuitDraft", "ValidateCircuit", "ApplyCircuitLayout"} <= ops
    assert spec["components"]["securitySchemes"]["APIKeyHeader"]["name"] == "X-API-Key"
