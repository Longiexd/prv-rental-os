import importlib.util
import json
from pathlib import Path
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy"))
from tenant_compose import compose_document, names
from admin import Admin
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


@pytest.mark.parametrize("code", ["../atlas", "atlas;touch", "atlas_name", "A", "a"*100, "atlas\n"])
def test_invalid_names_cannot_reach_docker_or_sql(code):
    with pytest.raises(ValueError): names("staging", code)


def test_image_tags_cannot_silently_change_on_next_onboarding():
    with pytest.raises(ValueError, match="immutable"):
        compose_document("staging", "atlas", "odoo:latest", POSTGRES)


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
