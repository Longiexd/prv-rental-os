"""Render isolated Compose stacks. This module contains no generated secrets."""
import re


def names(environment, code):
    if environment not in {"development", "staging", "production"} or not re.fullmatch(r"[a-z][a-z0-9-]{1,31}", code):
        raise ValueError("Invalid environment/company code")
    project = f"klynx-{environment}-{code}"
    return project, project + "-odoo", "db_" + code.replace("-", "_")


def compose_document(environment, code, odoo_image, postgres_image):
    project, host, database = names(environment, code)
    for image in (odoo_image, postgres_image):
        if not re.fullmatch(r"[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}", image):
            raise ValueError("Images must use immutable sha256 digests")
    logging = {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}}
    return {
        "name": project,
        "services": {
            "postgres": {
                "image": postgres_image, "restart": "unless-stopped", "mem_limit": "512m", "cpus": 1,
                "pids_limit": 256, "shm_size": "128m", "logging": logging,
                "security_opt": ["no-new-privileges:true"],
                "environment": {"POSTGRES_USER": "postgres", "POSTGRES_DB": "postgres", "POSTGRES_PASSWORD_FILE": "/run/secrets/postgres-password"},
                "volumes": ["postgres-data:/var/lib/postgresql/data", "./postgres-password:/run/secrets/postgres-password:ro", "./bootstrap.sql:/docker-entrypoint-initdb.d/10-klynx.sql:ro"],
                "networks": ["database"],
                "healthcheck": {"test": ["CMD", "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", database], "interval": "5s", "timeout": "3s", "retries": 30},
            },
            "odoo": {
                "image": odoo_image, "entrypoint": ["odoo"], "command": ["--config=/etc/odoo/odoo.conf"],
                "user": "odoo", "restart": "unless-stopped", "read_only": True,
                "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"],
                "mem_limit": "1g", "cpus": 1, "pids_limit": 256, "logging": logging,
                "tmpfs": ["/tmp:rw,nosuid,nodev,size=128m"],
                "depends_on": {"postgres": {"condition": "service_healthy"}},
                "volumes": ["odoo-data:/var/lib/odoo", "./odoo.conf:/etc/odoo/odoo.conf:ro"],
                "networks": {"application": {"aliases": [host]}, "database": {}},
                "healthcheck": {"test": ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8069/web/health', timeout=3)"], "interval": "10s", "timeout": "5s", "retries": 12, "start_period": "30s"},
            },
        },
        "volumes": {"postgres-data": {}, "odoo-data": {}},
        "networks": {
            "application": {"name": project + "-app", "internal": True},
            "database": {"name": project + "-db", "internal": True},
        },
    }
