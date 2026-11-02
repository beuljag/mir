import json

from fastapi.testclient import TestClient
import pytest

import app.main as main_module


def test_persistent_file_and_environment_precedence(tmp_path, monkeypatch):
    monkeypatch.setattr(main_module, "ROOT", tmp_path)
    monkeypatch.delenv("CIRCUIT_API_KEYS", raising=False)
    config = tmp_path / "config"
    config.mkdir()
    fixed_key = "persistent-file-test-key-123456789"
    (config / "local-api-keys.json").write_text(json.dumps({fixed_key: "local-user"}), encoding="utf-8")
    for _ in range(2):
        with TestClient(main_module.create_app(str(tmp_path / "test.db"))) as client:
            assert client.get("/components/search", headers={"X-API-Key": fixed_key}).status_code == 200
    env_key = "environment-test-key-123456789"
    monkeypatch.setenv("CIRCUIT_API_KEYS", json.dumps({env_key: "env-user"}))
    with TestClient(main_module.create_app(str(tmp_path / "test.db"))) as client:
        assert client.get("/components/search", headers={"X-API-Key": fixed_key}).status_code == 401
        assert client.get("/components/search", headers={"X-API-Key": env_key}).status_code == 200


def test_missing_keys_fail_closed(tmp_path, monkeypatch):
    monkeypatch.setattr(main_module, "ROOT", tmp_path)
    monkeypatch.delenv("CIRCUIT_API_KEYS", raising=False)
    with pytest.raises(RuntimeError):
        main_module.create_app(str(tmp_path / "test.db"))
