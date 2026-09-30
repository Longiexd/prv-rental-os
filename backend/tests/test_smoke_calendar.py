"""Validate the calendar URL used by the real-container smoke test."""
import ast
from pathlib import Path
from unittest.mock import patch

from app.odoo_client import OdooClient
from test_tenancy import client, control, headers, issue


def test_smoke_calendar_request_satisfies_route_contract(client, control):
    source = Path(__file__).resolve().parents[2] / "deploy" / "integration_smoke.py"
    calendar_urls = [node.value for node in ast.walk(ast.parse(source.read_text()))
                     if isinstance(node, ast.Constant) and isinstance(node.value, str)
                     and node.value.startswith("/calendar")]
    assert calendar_urls
    with patch.object(OdooClient, "check"), patch.object(OdooClient, "execute", return_value=[]) as execute:
        for url in calendar_urls:
            response = client.get(url, headers=headers(control, issue(control)))
            assert response.status_code == 200, response.text
            assert response.json()["rentals"] == []
        execute.assert_called()
