import io
import logging
import sys

from scripts import run_tunnel


def test_existing_tunnel_config_and_dotenv_take_precedence(tmp_path, monkeypatch):
    monkeypatch.setattr(run_tunnel, "ROOT", tmp_path)
    for key in ("DEVTUNNEL_ID", "DEVTUNNEL_PUBLIC_URL", "DEVTUNNEL_HOST_TOKEN"):
        monkeypatch.delenv(key, raising=False)
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "tunnel.json").write_text(
        '{"tunnel_id":"saved-tunnel","public_url":"https://saved.devtunnels.ms"}', encoding="utf-8"
    )
    assert run_tunnel.tunnel_settings() == ("saved-tunnel", "https://saved.devtunnels.ms", "")
    (tmp_path / ".env").write_text(
        'DEVTUNNEL_ID=new-tunnel\nDEVTUNNEL_HOST_TOKEN="test-host-token"\n', encoding="utf-8"
    )
    assert run_tunnel.tunnel_settings() == ("new-tunnel", "https://saved.devtunnels.ms", "test-host-token")


def test_host_token_is_only_passed_through_stdin(tmp_path, monkeypatch, capsys):
    token = "fixture-host-token"
    monkeypatch.setattr(run_tunnel, "ROOT", tmp_path)
    monkeypatch.setenv("DEVTUNNEL_HOST_TOKEN", token)
    monkeypatch.setenv("DEVTUNNEL_ID", "fixture-tunnel")
    monkeypatch.setenv("DEVTUNNEL_PUBLIC_URL", "https://fixture.devtunnels.ms")
    monkeypatch.setattr(sys, "argv", ["run_tunnel.py", "--settings"])
    run_tunnel.main()
    assert token not in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["run_tunnel.py"])
    monkeypatch.setattr(run_tunnel, "tunnel_executable", lambda: "devtunnel")
    monkeypatch.setattr(run_tunnel.signal, "signal", lambda *_: None)
    sent = []

    class Input(io.StringIO):
        def close(self):
            sent.append(self.getvalue())
            super().close()

    class Child:
        stdin = Input()
        stdout = io.StringIO("diagnostic " + token + "\n")

        def wait(self):
            return 1

        def poll(self):
            return 1

    def launch(command, **options):
        assert command[-2:] == ["--access-token", "-"]
        assert token not in command
        assert "DEVTUNNEL_HOST_TOKEN" not in options["env"]
        return Child()

    class EndTest(Exception):
        pass

    def stop_after_first_attempt(_):
        raise EndTest()

    monkeypatch.setattr(run_tunnel.subprocess, "Popen", launch)
    monkeypatch.setattr(run_tunnel.time, "sleep", stop_after_first_attempt)
    logger = logging.getLogger("circuit.tunnel")
    previous_handlers = set(logger.handlers)
    try:
        import pytest
        with pytest.raises(EndTest):
            run_tunnel.main()
    finally:
        for handler in set(logger.handlers) - previous_handlers:
            logger.removeHandler(handler)
            handler.close()
    assert sent == [token + "\n"]
    assert "diagnostic [redacted]" in (tmp_path / "logs" / "tunnel.log").read_text(encoding="utf-8")
    assert token not in (tmp_path / "logs" / "tunnel.log").read_text(encoding="utf-8")
