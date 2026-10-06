import importlib.util
import json
from pathlib import Path
import sys
import subprocess
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy"))
from tenant_compose import compose_document, names
from admin import Admin, command, database_bootstrap, repair_runtime_user
from test_tenancy import control

ODOO = "odoo@sha256:" + "a"*64
POSTGRES = "postgres@sha256:" + "b"*64


def test_stacks_have_separate_names_networks_and_storage():
    stacks = [compose_document(environment, code, ODOO, POSTGRES) for environment in ("staging", "production") for code in ("atlas", "bravo")]
    assert len({stack["name"] for stack in stacks}) == 4
    assert len({stack["networks"]["database"]["name"] for stack in stacks}) == 4
    for stack in stacks:
        for service in stack["services"].values():
            assert "ports" not in service
            assert "docker.sock" not in json.dumps(service)
            assert service["mem_limit"] and service["pids_limit"]
        assert stack["services"]["postgres"]["networks"] == ["database"]
        assert stack["networks"]["database"]["internal"] is True
        assert "external" not in stack["volumes"]["postgres-data"]
        assert stack["services"]["odoo"]["user"] == "odoo"


@pytest.mark.parametrize("code", ["../atlas", "atlas;touch", "atlas_name", "A", "a"*100, "atlas\n"])
def test_invalid_names_cannot_reach_docker_or_sql(code):
    with pytest.raises(ValueError): names("staging", code)


def test_image_tags_cannot_silently_change_on_next_onboarding():
    with pytest.raises(ValueError, match="immutable"):
        compose_document("staging", "atlas", "odoo:latest", POSTGRES)


def test_database_bootstrap_limits_maintenance_database_access_to_odoo():
    sql = database_bootstrap("db_atlas", "private-test-password")
    assert "CREATE DATABASE db_atlas OWNER odoo;" in sql
    assert "REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;" in sql
    assert "GRANT CONNECT ON DATABASE postgres TO odoo;" in sql
    assert sql.index("REVOKE CONNECT") < sql.index("GRANT CONNECT")


def test_failed_reset_revokes_access_before_contacting_odoo(control):
    token = control.create_session(control.lookup("atlas", "sarah"), "odoo-private")
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), patch.object(admin, "shell", side_effect=RuntimeError("offline")):
        with pytest.raises(RuntimeError): admin.user("reset-user", "atlas", "sarah", password="fresh-strong-password")
    assert control.lookup("atlas", "sarah") is None
    with pytest.raises(Exception): control.session(token)


def test_interrupted_user_creation_can_resume_without_enabling_partial_account(control):
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), patch.object(admin, "shell", side_effect=RuntimeError("offline")):
        with pytest.raises(RuntimeError): admin.user("add-user", "atlas", "maria", "Maria", "fresh-strong-password")
    assert control.lookup("atlas", "maria") is None
    with patch.object(admin, "control", return_value=control), patch.object(admin, "shell", return_value={"uid": 9}):
        admin.user("add-user", "atlas", "maria", "Maria", "fresh-strong-password")
    assert control.lookup("atlas", "maria")["uid"] == 9
    assert control.lookup("atlas", "maria")["role"] == "operator"


def test_suspension_does_not_change_other_company(control):
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control): admin.suspend("atlas")
    assert control.lookup("atlas", "sarah") is None
    assert control.lookup("bravo", "sarah") is not None


def test_reprovisioning_active_company_is_rejected(control):
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), patch.object(admin, "compose") as compose:
        with pytest.raises(ValueError): admin.resume_company("atlas")
    compose.assert_not_called()


def test_initialization_errors_are_useful_and_redact_all_supplied_secrets():
    secret_values = ("database-secret-for-test", "master-secret-for-test", "postgres-secret-for-test")
    result = subprocess.CompletedProcess(["docker"], 1,
        stdout="config password=" + secret_values[0],
        stderr="PermissionError: [Errno 13] Permission denied: '/var/lib/odoo/sessions'\n" + " ".join(secret_values[1:]))
    with patch("admin.subprocess.run", return_value=result), pytest.raises(RuntimeError) as error:
        command(["docker"], diagnostic_label="Odoo database initialization", redactions=secret_values)
    message = str(error.value)
    assert "exit 1" in message and "PermissionError" in message and "/var/lib/odoo/sessions" in message
    assert "[REDACTED]" in message
    assert all(value not in message for value in secret_values)


def test_private_shell_output_is_withheld_even_when_diagnostics_requested():
    result = subprocess.CompletedProcess(["docker"], 1, stdout="worker-password-in-stdin", stderr="worker-password-in-stdin")
    with patch("admin.subprocess.run", return_value=result), pytest.raises(RuntimeError) as error:
        command(["docker"], stdin="worker-password-in-stdin", diagnostic_label="Private operation")
    assert "worker-password" not in str(error.value)
    assert "withheld" in str(error.value)


def test_unlabelled_command_does_not_expose_output():
    result = subprocess.CompletedProcess(["docker"], 137, stdout="sensitive", stderr="sensitive")
    with patch("admin.subprocess.run", return_value=result), pytest.raises(RuntimeError) as error:
        command(["docker"])
    assert "exit 137" in str(error.value) and "sensitive" not in str(error.value)


def test_integration_smoke_diagnostics_are_bounded_and_redacted():
    secret_values = ("worker-password-for-test", "session-key-for-test", "proxy-key-for-test")
    result = subprocess.CompletedProcess(
        ["docker"], 1,
        stdout="smoke: authenticating both isolated company users\n",
        stderr=f"RuntimeError: company 1 login: expected HTTP 200, got HTTP 502\n{secret_values[0]}",
    )
    with patch("admin.subprocess.run", return_value=result), pytest.raises(RuntimeError) as error:
        command(["docker"], diagnostic_label="Two-company API smoke test", redactions=secret_values)
    message = str(error.value)
    assert "company 1 login: expected HTTP 200, got HTTP 502" in message
    assert "smoke: authenticating both isolated company users" in message
    assert all(value not in message for value in secret_values)


def test_runtime_user_repair_preserves_stack_configuration_and_data(tmp_path):
    document = compose_document("staging", "atlas", ODOO, POSTGRES)
    document["services"]["odoo"]["user"] = "101:101"
    path = tmp_path / "compose.json"
    path.write_text(json.dumps(document))
    data = tmp_path / "data-sentinel"
    data.write_bytes(b"existing-company-data")
    repair_runtime_user(tmp_path)
    document["services"]["odoo"]["user"] = "odoo"
    assert json.loads(path.read_text()) == document
    before = path.read_bytes()
    repair_runtime_user(tmp_path)
    assert path.read_bytes() == before
    assert data.read_bytes() == b"existing-company-data"


def test_cannot_emit_diagnostic_output_when_secret_file_is_missing(tmp_path):
    admin = Admin("staging")
    admin.root = tmp_path
    directory = admin.directory("atlas")
    directory.mkdir(parents=True)
    (directory / "odoo.conf").write_text("[options]\ndb_password=test-password\nadmin_passwd=test-master\n")
    with patch("admin.command") as run, pytest.raises(FileNotFoundError):
        admin.compose("atlas", "up", diagnostic_label="Bootstrap")
    run.assert_not_called()
