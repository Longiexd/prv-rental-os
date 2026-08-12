import requests

from app.config import (
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_PASSWORD,
    ODOO_URL,
)


class OdooClient:

    # =========================================================
    # INIT
    # =========================================================

    def __init__(self):
        self.uid = None

    # =========================================================
    # AUTHENTICATION
    # =========================================================

    def authenticate(self):

        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "service": "common",
                "method": "authenticate",
                "args": [
                    ODOO_DB,
                    ODOO_USERNAME,
                    ODOO_PASSWORD,
                    {},
                ],
            },
            "id": 1,
        }

        response = requests.post(
            f"{ODOO_URL}/jsonrpc",
            json=payload,
        )

        data = response.json()

        if not data.get("result"):
            raise Exception(
                f"Odoo authentication failed: {data}"
            )

        self.uid = data["result"]

        return self.uid

    # =========================================================
    # EXECUTE ODOO RPC
    # =========================================================

    def execute(self, model, method, args=None, kwargs=None):

        if self.uid is None:
            self.authenticate()

        if args is None:
            args = []

        if kwargs is None:
            kwargs = {}

        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "service": "object",
                "method": "execute_kw",
                "args": [
                    ODOO_DB,
                    self.uid,
                    ODOO_PASSWORD,
                    model,
                    method,
                    args,
                    kwargs,
                ],
            },
            "id": 1,
        }

        response = requests.post(
            f"{ODOO_URL}/jsonrpc",
            json=payload,
        )

        data = response.json()

        if "error" in data:
            raise Exception(data["error"])

        return data["result"]


odoo = OdooClient()