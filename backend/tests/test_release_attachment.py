import json
from pathlib import Path
import socket
import subprocess
import sys
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy"))
from admin import Admin, command, registered_odoo_route
import odoo_probe
from tenant_compose import names
from test_tenancy import control


@pytest.mark.parametrize("environment", ["development", "staging", "production"])
def test_registered_generated_endpoint_keeps_environment_and_database(environment):
    project, host, _ = names(environment, "atlas")
    network, url = registered_odoo_route(environment, "atlas", f"http://{host}:8069", "db_atlas")
    assert network == project + "-app"
    assert url == f"http://{host}:8069/web/health?db=db_atlas"


def test_legacy_staging_registry_uses_legacy_network_instead_of_generated_demo_stack():
    assert registered_odoo_route("staging", "demo-rentals", "http://klynx-odoo-staging:8069", "klynx_staging") == (
        "klynx-odoo-staging", "http://klynx-odoo-staging:8069/web/health?db=klynx_staging")


@pytest.mark.parametrize("endpoint", [
    "http://klynx-odoo-production:8069", "http://klynx-production-atlas-odoo:8069",
    "http://klynx-staging-bravo-odoo:8069", "http://external.example:8069",
    "https://klynx-odoo-staging:8069", "http://klynx-odoo-staging:80",
    "http://user:private-password@klynx-odoo-staging:8069",
    "http://klynx-odoo-staging:8069?secret=private-password",
    "http://klynx-odoo-staging:8069/#other", "http://klynx-odoo-staging:invalid",
])
def test_unknown_cross_environment_or_credential_bearing_routes_fail_closed(endpoint):
    with pytest.raises(ValueError) as error:
        registered_odoo_route("staging", "atlas", endpoint, "db_atlas")
    assert endpoint not in str(error.value) and "private-password" not in str(error.value)


def test_attachment_reconnects_registered_legacy_network_once_and_checks_each_database(control):
    with control.db(True) as db:
        db.execute("UPDATE companies SET endpoint='http://klynx-odoo-staging:8069'")
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        return "api-id" if args[1] == "ps" else "{}" if args[1] == "inspect" else ""
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), patch("admin.command", side_effect=run):
        admin.attach_api()
    connects = [args for args in calls if args[1:3] == ["network", "connect"]]
    assert connects == [["docker", "network", "connect", "klynx-odoo-staging", "klynx-rental-api-staging"]]
    probes = [args for args in calls if args[1] == "exec"]
    assert {args[-1] for args in probes} == {
        "http://klynx-odoo-staging:8069/web/health?db=db_atlas",
        "http://klynx-odoo-staging:8069/web/health?db=db_bravo",
    }
    assert all("klynx-staging-demo-rentals" not in args[-1] for args in probes)


def test_existing_generated_network_is_reused_and_not_connected_to_legacy(control):
    with control.db(True) as db:
        db.execute("UPDATE companies SET status='suspended' WHERE code='bravo'")
        db.execute("UPDATE companies SET endpoint='http://klynx-staging-atlas-odoo:8069' WHERE code='atlas'")
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), \
         patch("admin.command", side_effect=["api-id", json.dumps({"klynx-staging-atlas-app": {}}), ""]) as run:
        admin.attach_api()
    assert run.call_count == 3
    assert run.call_args.args[0][-1] == "http://klynx-staging-atlas-odoo:8069/web/health?db=db_atlas"


def test_all_registered_routes_are_validated_before_any_network_mutation(control):
    admin = Admin("staging")
    with patch.object(admin, "control", return_value=control), \
         patch("admin.command", side_effect=["api-id", "{}"]) as run, pytest.raises(ValueError):
        admin.attach_api()
    assert run.call_count == 2


def test_allow_absent_does_not_load_registry_or_attach_networks():
    admin = Admin("staging")
    with patch("admin.command", return_value="") as run, patch.object(admin, "control") as store:
        admin.attach_api(allow_absent=True)
    run.assert_called_once()
    store.assert_not_called()


@pytest.mark.parametrize("error,reason", [
    (urllib.error.URLError(socket.gaierror("private host detail")), "hostname could not be resolved"),
    (urllib.error.URLError(ConnectionRefusedError("private connection detail")), "connection was refused"),
    (urllib.error.URLError(TimeoutError("private timeout detail")), "connection timed out"),
    (urllib.error.HTTPError("http://private-target", 500, "private response", {}, None), "HTTP 500"),
    (RuntimeError("private traceback detail"), "health probe failed"),
])
def test_probe_failures_are_bounded_retried_and_never_print_private_details(error, reason):
    opener = MagicMock()
    opener.open.side_effect = error
    with patch.object(odoo_probe.urllib.request, "build_opener", return_value=opener), \
         patch.object(odoo_probe.time, "sleep") as sleep, pytest.raises(RuntimeError) as failure:
        odoo_probe.probe("http://private-target", attempts=3)
    assert opener.open.call_count == 3 and sleep.call_count == 2
    assert reason in str(failure.value) and "private" not in str(failure.value)


def test_probe_recovers_from_cold_start_without_changing_target():
    opener = MagicMock()
    success = MagicMock()
    success.__enter__.return_value.status = 200
    opener.open.side_effect = [urllib.error.URLError(ConnectionRefusedError()), success]
    with patch.object(odoo_probe.urllib.request, "build_opener", return_value=opener), \
         patch.object(odoo_probe.time, "sleep") as sleep:
        odoo_probe.probe("http://target:8069/web/health?db=db_atlas")
    assert opener.open.call_count == 2 and sleep.call_count == 1
    assert opener.open.call_args_list[0] == opener.open.call_args_list[1]


def test_probe_rejects_redirects():
    assert odoo_probe.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "http://foreign") is None


def test_safe_probe_diagnostic_surfaces_status_and_company():
    result = subprocess.CompletedProcess(["docker"], 1, stdout="", stderr="Odoo health returned HTTP 500")
    with patch("admin.subprocess.run", return_value=result), pytest.raises(RuntimeError) as failure:
        command(["docker", "exec"], diagnostic_label="Registered Odoo health check for atlas")
    assert "atlas" in str(failure.value) and "HTTP 500" in str(failure.value)
