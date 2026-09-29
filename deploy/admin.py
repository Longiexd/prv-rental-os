#!/usr/bin/env python3
"""Private Klynx host tool. Run as root over SSH; never expose as a web service."""
import argparse
import configparser
from contextlib import contextmanager
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from cryptography.fernet import Fernet
from app.control import CODE, LOGIN, Control, Settings
from tenant_compose import compose_document, names


def command(args, *, stdin=None, timeout=1200, diagnostic_label=None, redactions=()):
    label = diagnostic_label or "Private administration operation"
    try:
        result = subprocess.run(args, input=stdin, text=True, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"{label} timed out after {timeout} seconds.") from None
    if result.returncode:
        message = f"{label} failed (exit {result.returncode})."
        # Only opted-in bootstrap operations may expose bounded, redacted output.
        # Odoo shell stdin can contain worker passwords and must never be printed.
        if diagnostic_label and stdin is None:
            output = (result.stdout or "") + "\n" + (result.stderr or "")
            for value in sorted((value for value in redactions if value), key=len, reverse=True):
                output = output.replace(value, "[REDACTED]")
            output = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", output)
            output = "".join(char for char in output if char >= " " or char in "\n\t")
            message += "\n" + output.strip()[-6000:]
        else:
            message += " Output withheld because it may contain credentials."
        raise RuntimeError(message)
    return result.stdout


def write_new(path, text, mode=0o600):
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    path.chmod(mode)


def repair_runtime_user(directory):
    """Upgrade only the known faulty user setting in an incomplete company's stack."""
    path = directory / "compose.json"
    document = json.loads(path.read_text())
    if document["services"]["odoo"].get("user") != "101:101":
        return
    document["services"]["odoo"]["user"] = "odoo"
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory, delete=False) as handle:
        json.dump(document, handle, indent=2)
        temporary = Path(handle.name)
    temporary.chmod(0o600)
    temporary.replace(path)


class AdminControl(Control):
    @contextmanager
    def db(self, write=False):
        # SQLite WAL files must have the same owner as the running API's files.
        os.setegid(10001)
        os.seteuid(10001)
        try:
            with super().db(write) as connection:
                yield connection
        finally:
            os.seteuid(0)
            os.setegid(0)


class Admin:
    def __init__(self, environment):
        self.environment = environment
        self.root = Path("/var/lib/klynx") / environment
        self.keys = Path("/etc/klynx") / environment

    def control(self):
        control = AdminControl(Settings(self.environment, self.root / "control",
                                  (self.keys / "session.key").read_bytes().strip(),
                                  (self.keys / "proxy.key").read_text().strip()))
        control.verify()
        return control

    @contextmanager
    def lock(self):
        import fcntl
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.root.parent.chmod(0o711)
        self.root.chmod(0o711)
        with (self.root / "admin.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError("Another Klynx administration operation is running; retry when it finishes") from None
            yield

    def initialize(self, odoo_image, postgres_image):
        compose_document(self.environment, "validation", odoo_image, postgres_image)
        self.keys.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        settings_file = self.root / "images.json"
        if (self.root / "control" / "control.sqlite3").exists() and any(not (self.keys / key).exists() for key in ("session.key", "proxy.key")):
            raise ValueError("Existing registry has a missing key; restore the key rather than silently replacing it")
        if settings_file.exists() and json.loads(settings_file.read_text()) != {"odoo": odoo_image, "postgres": postgres_image}:
            raise ValueError("Image policy already exists; upgrades require a separate tested rollout")
        if not settings_file.exists():
            write_new(settings_file, json.dumps({"odoo": odoo_image, "postgres": postgres_image}))
        for name, value in (("session.key", Fernet.generate_key().decode()), ("proxy.key", secrets.token_urlsafe(48))):
            path = self.keys / name
            if not path.exists():
                write_new(path, value + "\n", 0o400)
            os.chown(path, 10001, 10001)
        os.chown(self.keys, 10001, 10001)
        self.keys.chmod(0o500)
        control = Control(Settings(self.environment, self.root / "control", (self.keys / "session.key").read_bytes().strip(), (self.keys / "proxy.key").read_text().strip()))
        control.initialize()
        for path in (control.path.parent, *control.path.parent.iterdir()):
            os.chown(path, 10001, 10001)
        self.control().audit("klynx", "", "initialize")
        print("Registry initialized. Install the proxy key as a secret on this environment's Worker before rollout.")

    def directory(self, code):
        names(self.environment, code)
        return self.root / "companies" / code

    def compose(self, code, *args, stdin=None, diagnostic_label=None):
        redactions = []
        if diagnostic_label:
            # Fail closed if the secret files cannot be read: do not emit unredacted logs.
            config = configparser.ConfigParser(interpolation=None)
            config.read_string((self.directory(code) / "odoo.conf").read_text())
            redactions = [config["options"]["db_password"], config["options"]["admin_passwd"],
                          (self.directory(code) / "postgres-password").read_text().strip()]
        return command(["docker", "compose", "--project-directory", str(self.directory(code)), "-f", str(self.directory(code) / "compose.json"), *args],
                       stdin=stdin, diagnostic_label=diagnostic_label, redactions=redactions)

    def shell(self, code, operation, data):
        script = (Path(__file__).parent / "odoo_admin.py").read_text()
        # Data is serialized into stdin, not shell arguments, environment, or a persistent file.
        script += "\nrun(env, " + repr(operation) + ", " + repr(data) + ")\n"
        output = self.compose(code, "run", "--rm", "-T", "--no-deps", "odoo", "shell", "--config=/etc/odoo/odoo.conf", "--no-http", stdin=script)
        for line in output.splitlines():
            if line.startswith("KLYNX_RESULT="):
                return json.loads(line.partition("=")[2])
        raise RuntimeError("Odoo did not confirm the operation")

    def add_company(self, code, name, country, currency, chart):
        project, host, database = names(self.environment, code)
        if not name.strip() or len(name) > 120 or not country.isalpha() or len(country) != 2 or not currency.isalpha() or len(currency) != 3 or not chart or len(chart) > 64:
            raise ValueError("Company name, ISO country/currency, and accounting template are required")
        control = self.control()
        directory = self.directory(code)
        with control.db() as db:
            if db.execute("SELECT 1 FROM companies WHERE code=?", (code,)).fetchone():
                raise ValueError("Company is already registered; use resume for incomplete provisioning")
        if directory.exists():
            raise ValueError("Company files already exist. Use resume-company; nothing was replaced.")
        target_directory = directory
        directory.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory = directory.with_name("." + code + "-" + secrets.token_hex(8))
        directory.mkdir(mode=0o700)
        images = json.loads((self.root / "images.json").read_text())
        manifest = {"code": code, "name": name, "country": country.upper(), "currency": currency.upper(), "chart": chart}
        write_new(directory / "company.json", json.dumps(manifest))
        password = secrets.token_hex(32)
        write_new(directory / "postgres-password", secrets.token_hex(32), 0o444)
        write_new(directory / "bootstrap.sql", f"CREATE ROLE odoo LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nCREATE DATABASE {database} OWNER odoo;\nREVOKE CONNECT ON DATABASE postgres FROM PUBLIC;\n", 0o444)
        config = f"""[options]
db_host = postgres
db_port = 5432
db_user = odoo
db_password = {password}
db_name = {database}
dbfilter = ^{database}$
list_db = False
admin_passwd = {secrets.token_hex(48)}
data_dir = /var/lib/odoo
http_port = 8069
proxy_mode = False
workers = 0
max_cron_threads = 1
db_maxconn = 16
limit_time_real = 120
limit_time_cpu = 90
log_level = warn
"""
        write_new(directory / "odoo.conf", config, 0o444)
        write_new(directory / "compose.json", json.dumps(compose_document(self.environment, code, images["odoo"], images["postgres"]), indent=2))
        directory.rename(target_directory)
        with control.db(True) as db:
            db.execute("INSERT INTO companies VALUES (?,?,?,?,?)", (code, name, f"http://{host}:8069", database, "provisioning"))
        control.audit("klynx", code, "provision-start")
        self.resume_company(code)

    def resume_company(self, code):
        control = self.control()
        project, host, database = names(self.environment, code)
        directory = self.directory(code)
        with control.db() as db:
            row = db.execute("SELECT status FROM companies WHERE code=?", (code,)).fetchone()
        if row and row[0] not in {"provisioning", "failed"}:
            raise ValueError("Only an incomplete company can be resumed")
        data = json.loads((directory / "company.json").read_text())
        if data["code"] != code:
            raise ValueError("Company manifest does not match")
        if not row:
            # Recover a crash between atomic file creation and registry registration.
            with control.db(True) as db:
                db.execute("INSERT INTO companies VALUES (?,?,?,?,?)", (code, data["name"], f"http://{host}:8069", database, "provisioning"))
        try:
            repair_runtime_user(directory)
            self.compose(code, "config", "--quiet")
            self.compose(code, "up", "-d", "--wait", "postgres", diagnostic_label=f"PostgreSQL startup for {code}")
            if not (directory / "database-ready").exists():
                print(f"{code}: checking Odoo user and writable data volume", flush=True)
                self.compose(code, "run", "--rm", "-T", "--no-deps", "--entrypoint", "python3", "odoo", "-c",
                             "import os,pwd,tempfile; assert os.geteuid()!=0 and pwd.getpwuid(os.geteuid()).pw_name=='odoo', 'Expected the image Odoo account'; f=tempfile.TemporaryFile(dir='/var/lib/odoo'); f.write(b'permission-check'); f.close()",
                             diagnostic_label=f"Odoo data-volume permission check for {code}")
                print(f"{code}: initializing Odoo database and business modules", flush=True)
                self.compose(code, "run", "--rm", "-T", "--no-deps", "odoo", "--config=/etc/odoo/odoo.conf", "--stop-after-init", "-i", "base,crm,sale_management,fleet,account", "--without-demo=all",
                             diagnostic_label=f"Odoo database initialization for {code}")
                write_new(directory / "database-ready", "initialized\n")
            self.shell(code, "configure", data)
            self.compose(code, "up", "-d", "--wait", "odoo")
            self.shell(code, "check", {})
            with control.db(True) as db:
                db.execute("UPDATE companies SET status='active' WHERE code=?", (code,))
            self.attach_api(allow_absent=True)
            control.audit("klynx", code, "provision-complete")
            print(f"{code}: company ready. Use Add user to issue worker credentials.")
        except Exception:
            with control.db(True) as db:
                db.execute("UPDATE companies SET status='failed' WHERE code=?", (code,))
            control.audit("klynx", code, "provision-failed")
            raise

    def attach_api(self, allow_absent=False):
        container = "klynx-rental-api-" + self.environment
        found = command(["docker", "ps", "-a", "--filter", "name=^/" + container + "$", "--format", "{{.ID}}"])
        if not found.strip():
            if allow_absent:
                return
            raise RuntimeError("API container is absent")
        networks = json.loads(command(["docker", "inspect", "--format", "{{json .NetworkSettings.Networks}}", container]))
        with self.control().db() as db:
            codes = [row[0] for row in db.execute("SELECT code FROM companies WHERE status='active'")]
        for code in codes:
            network = names(self.environment, code)[0] + "-app"
            if network not in networks:
                command(["docker", "network", "connect", network, container])
            endpoint = "http://" + names(self.environment, code)[1] + ":8069/web/health"
            command(["docker", "exec", container, "python", "-c", "import urllib.request; urllib.request.urlopen(" + repr(endpoint) + ", timeout=5)"])

    def user(self, operation, code, login, name="", password=None):
        if not CODE.fullmatch(code) or not LOGIN.fullmatch(login) or login in {"admin", "default", "public", "root"}:
            raise ValueError("Use a valid company and a non-reserved lowercase login")
        if password is not None and not 16 <= len(password) <= 128:
            raise ValueError("Use a password of 16–128 characters")
        control = self.control()
        with control.db(True) as db:
            company = db.execute("SELECT status FROM companies WHERE code=?", (code,)).fetchone()
            existing = db.execute("SELECT uid FROM users WHERE company=? AND login=?", (code, login)).fetchone()
            if not company or company[0] != "active":
                raise ValueError("Company must be active")
            if operation == "add-user" and ((existing and existing[0] != -1) or not name.strip()):
                raise ValueError("User already exists or name is empty")
            if operation != "add-user" and not existing:
                raise ValueError("User not found")
            if operation == "add-user" and not existing:
                db.execute("INSERT INTO users VALUES (?,?,?,'operator',0)", (code, login, -1))
            if existing:
                # Fail closed during reset/disable, including when Odoo is unreachable.
                db.execute("UPDATE users SET active=0 WHERE company=? AND login=?", (code, login))
                db.execute("DELETE FROM sessions WHERE company=? AND login=?", (code, login))
        data = {"login": login, "name": name}
        if existing:
            data["uid"] = existing[0]
        if password is not None:
            data["password"] = password
        result = self.shell(code, operation, data)
        with control.db(True) as db:
            if operation == "add-user":
                db.execute("UPDATE users SET uid=?, active=1 WHERE company=? AND login=?", (result["uid"], code, login))
            else:
                db.execute("UPDATE users SET active=? WHERE company=? AND login=?", (operation != "disable-user", code, login))
        control.audit("klynx", code, operation, login)
        print(f"{operation} complete: {code}.{login}")

    def suspend(self, code):
        names(self.environment, code)
        control = self.control()
        with control.db(True) as db:
            if not db.execute("SELECT 1 FROM companies WHERE code=? AND status='active'", (code,)).fetchone():
                raise ValueError("Active company not found")
            db.execute("UPDATE companies SET status='suspended' WHERE code=?", (code,))
            db.execute("DELETE FROM sessions WHERE company=?", (code,))
        control.audit("klynx", code, "suspend")

    def reactivate(self, code):
        names(self.environment, code)
        control = self.control()
        with control.db() as db:
            row = db.execute("SELECT status FROM companies WHERE code=?", (code,)).fetchone()
        if not row or row[0] != "suspended":
            raise ValueError("Suspended company not found")
        self.shell(code, "check", {})
        with control.db(True) as db:
            db.execute("UPDATE companies SET status='active' WHERE code=?", (code,))
        try:
            self.attach_api(allow_absent=True)
        except Exception:
            with control.db(True) as db:
                db.execute("UPDATE companies SET status='suspended' WHERE code=?", (code,))
            raise
        control.audit("klynx", code, "reactivate")

    def list_companies(self):
        with self.control().db() as db:
            for row in db.execute("SELECT code,name,status FROM companies ORDER BY code"):
                print(" | ".join(row))


def password_input():
    password = getpass.getpass("Password (16+ characters; blank to generate): ")
    if not password:
        password = secrets.token_urlsafe(24)
        print("Generated password (shown once): " + password)
    elif password != getpass.getpass("Repeat password: "):
        raise ValueError("Passwords differ")
    return password


def menu(admin):
    while True:
        print(f"\nKlynx admin — {admin.environment}\n1 Add company\n2 Add user\n3 Reset password\n4 Disable user\n5 Enable user\n6 Suspend company\n7 List companies\n8 Reactivate company\n0 Exit")
        choice = input("Option: ").strip()
        if choice == "0":
            return
        try:
            if choice == "7":
                admin.list_companies()
                continue
            if choice not in {"1", "2", "3", "4", "5", "6", "8"}:
                continue
            code = input("Company code: ").strip().lower()
            # Do not hold a deployment/provisioning lock while waiting for terminal input.
            if choice == "1":
                details = (code, input("Company name: ").strip(), input("Country (ISO, e.g. FR): ").strip(), input("Currency (e.g. EUR): ").strip(), input("Odoo accounting template code (e.g. fr): ").strip())
                with admin.lock():
                    admin.add_company(*details)
            elif choice in {"2", "3", "4", "5"}:
                operation = {"2": "add-user", "3": "reset-user", "4": "disable-user", "5": "enable-user"}[choice]
                login = input("Worker login (without company prefix): ").strip().lower()
                name = input("Worker name: ").strip() if choice == "2" else ""
                password = password_input() if choice in {"2", "3"} else None
                with admin.lock():
                    admin.user(operation, code, login, name, password)
            else:
                with admin.lock():
                    (admin.suspend if choice == "6" else admin.reactivate)(code)
        except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            print(str(error) if isinstance(error, (ValueError, RuntimeError)) else "Operation interrupted; company data was preserved. Inspect state before retrying.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True, choices=["development", "staging", "production"])
    sub = parser.add_subparsers(dest="operation", required=True)
    initialize = sub.add_parser("init")
    initialize.add_argument("--odoo-image", required=True)
    initialize.add_argument("--postgres-image", required=True)
    for operation in ("menu", "attach-api", "list"):
        sub.add_parser(operation)
    resume = sub.add_parser("resume-company")
    resume.add_argument("code")
    args = parser.parse_args()
    if os.name != "posix" or os.geteuid() != 0:
        parser.error("Run this private tool as root on the Linux VPS")
    os.umask(0o077)
    admin = Admin(args.environment)
    if args.operation == "menu":
        menu(admin)
        return
    with admin.lock():
        if args.operation == "init":
            admin.initialize(args.odoo_image, args.postgres_image)
        elif args.operation == "attach-api":
            admin.attach_api()
        elif args.operation == "resume-company":
            admin.resume_company(args.code)
        elif args.operation == "list":
            admin.list_companies()


if __name__ == "__main__":
    main()
