"""Destructive cleanup is confined to disposable GitHub Actions company stacks."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time

from admin import Admin, command, write_new


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.geteuid() != 0:
        raise RuntimeError("This integration runner is only for an ephemeral GitHub Actions Linux host")
    root = Path(tempfile.mkdtemp(prefix="klynx-ci-"))
    root.chmod(0o711)
    repository = Path(__file__).resolve().parents[1]
    admin = Admin("staging")
    admin.root = root / "state" / "staging"
    admin.keys = root / "keys" / "staging"
    container = "klynx-rental-api-staging"
    codes = ["ci-atlas", "ci-bravo"]
    try:
        with admin.lock():
            admin.initialize(os.environ["ODOO_IMAGE"], os.environ["POSTGRES_IMAGE"])
            credentials = []
            for code in codes:
                admin.add_company(code, code, "US", "USD")
                admin.control().set_features(code, "premium")  # Exercise all layers on disposable CI companies.
                privileges = admin.compose(code, "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "postgres", "-tAc", "SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='odoo'").strip()
                assert privileges == "f|f|f", "Odoo database role has excessive privileges"
                connections = admin.compose(code, "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "postgres", "-tAc", "SELECT has_database_privilege('odoo','postgres','CONNECT'),EXISTS (SELECT 1 FROM pg_database d, LATERAL aclexplode(d.datacl) a WHERE d.datname='postgres' AND a.grantee=0 AND a.privilege_type='CONNECT')").strip()
                assert connections == "t|f", "Maintenance database access is not restricted to Odoo"
                password = secrets.token_urlsafe(24)
                admin.user("add-user", code, "sarah", "Sarah", password)
                # Seed only disposable test companies; exercise Fleet as the normal operator.
                admin.compose(code, "run", "--rm", "-T", "--no-deps", "odoo", "shell", "--config=/etc/odoo/odoo.conf", "--no-http", stdin="brand=env['fleet.vehicle.model.brand'].create({'name':'CI Fleet'})\nmodel=env['fleet.vehicle.model'].create({'name':'CI Vehicle','brand_id':brand.id})\nstate=env['fleet.vehicle.state'].create({'name':'Maintenance'})\nenv['fleet.vehicle'].create({'model_id':model.id,'state_id':state.id,'license_plate':'CI-ONLY'})\nenv.cr.commit()\n")
                credentials.append({"username": code+".sarah", "password": password})
            command(["docker", "build", "-t", "klynx-api-integration", str(repository / "backend")])
            path = root / "credentials.json"
            write_new(path, json.dumps(credentials), 0o400)
            os.chown(path, 10001, 10001)
            command(["docker", "run", "-d", "--name", container,
                     "-e", "APP_ENV=staging", "-e", "CORS_ALLOWED_ORIGINS=https://staging.rental-os.klynx.net",
                     "-e", "KLYNX_STATE_DIR=/var/lib/klynx/control", "-e", "KLYNX_SESSION_KEY_FILE=/run/klynx/session.key", "-e", "KLYNX_PROXY_KEY_FILE=/run/klynx/proxy.key",
                     "-v", f"{admin.root / 'control'}:/var/lib/klynx/control", "-v", f"{admin.keys}:/run/klynx:ro",
                     "-v", f"{path}:/checks/credentials.json:ro", "-v", f"{repository / 'deploy/integration_smoke.py'}:/checks/smoke.py:ro",
                     "klynx-api-integration"])
            admin.attach_api()
            for attempt in range(30):
                try:
                    command(["docker", "exec", container, "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=3)"])
                    break
                except RuntimeError:
                    if attempt == 29: raise
                    time.sleep(1)
            # The smoke runner prints only phase names and HTTP status codes. Opt in to
            # bounded diagnostics and still redact every secret available to this host.
            redactions = [account["password"] for account in credentials]
            redactions.extend((admin.keys / name).read_text().strip() for name in ("session.key", "proxy.key"))
            print(command(["docker", "exec", container, "python", "/checks/smoke.py"],
                          diagnostic_label="Two-company API smoke test", redactions=redactions))
            # A failed reset must stay disabled; successful resets must replace the Odoo password.
            admin.user("disable-user", codes[1], "sarah")
            assert admin.control().lookup(codes[1], "sarah") is None
            admin.user("reset-user", codes[1], "sarah", password=secrets.token_urlsafe(24))
            assert admin.control().lookup(codes[1], "sarah")
    finally:
        subprocess.run(["docker", "rm", "-f", container], capture_output=True)
        for code in codes:
            if (admin.directory(code) / "compose.json").exists():
                admin.compose(code, "down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
