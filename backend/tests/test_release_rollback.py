"""Exercise the real installer with only host paths and external programs doubled."""
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

import pytest

pytestmark = pytest.mark.skipif(sys.platform == "win32" or not shutil.which("bash"),
                                reason="Release installer integration requires Linux Bash (runs in CI)")


@pytest.fixture
def install_harness(tmp_path):
    root = tmp_path / "host"
    old = root / "releases/staging/previous"
    (old / "backend/app").mkdir(parents=True)
    (old / "backend/app/control.py").touch()
    (root / "current-staging").symlink_to(old, target_is_directory=True)
    (root / "current-staging.sha").write_text("old-sha\n")
    state = tmp_path / "state/staging/control"
    state.mkdir(parents=True)
    (state / "control.sqlite3").touch()
    keys = tmp_path / "keys/staging"
    keys.mkdir(parents=True)
    for name in ("session.key", "proxy.key"):
        (keys / name).write_text("test-only-key")
    binaries = tmp_path / "bin"
    binaries.mkdir()
    stub = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
kind = Path(sys.argv[0]).name
log = Path(os.environ["INSTALL_TEST_LOG"])
events = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
with log.open("a") as file:
    file.write(json.dumps({"program": kind, "args": sys.argv[1:]}) + "\\n")
mode = os.environ["INSTALL_TEST_MODE"]
count = sum(event["program"] == kind for event in events)
if kind == "admin-python" and (mode == "rollback-fails" or (mode == "attachment-fails" and count == 0)):
    print("Registered Odoo health returned HTTP 500", file=sys.stderr)
    sys.exit(1)
if kind == "curl" and mode == "readiness-fails" and count < 30:
    sys.exit(1)
'''
    for program in ("docker", "curl", "sleep", "admin-python"):
        path = binaries / program
        path.write_text(stub)
        path.chmod(0o755)
    source = (Path(__file__).resolve().parents[2] / "deploy/install-release.sh").read_text()
    source = source.replace("/opt/klynx-rental-os", str(root))
    source = source.replace("/var/lib/klynx", str(tmp_path / "state"))
    source = source.replace("/etc/klynx", str(tmp_path / "keys"))
    source = source.replace("/opt/klynx-admin/venv/bin/python", str(binaries / "admin-python"))
    source = source.replace('expected_prefix="/tmp/klynx-$environment-"',
                            f'expected_prefix="{tmp_path}/klynx-$environment-"')
    script = tmp_path / "installer.sh"
    script.write_text(source)
    sha = "a" * 40
    archive = tmp_path / "klynx-staging-test.tar.gz"
    with tarfile.open(archive, "w:gz") as package:
        for name in ("backend/app/control.py", "deploy/admin.py", "docker-compose.staging.yml", "deploy/staging.compose.env"):
            payload = b"test-only\n"
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            package.addfile(info, io.BytesIO(payload))
    environment_file = tmp_path / "klynx-staging-test.env"
    environment_file.write_text("TEST_ONLY=1\n")
    log = tmp_path / "calls.jsonl"
    def run(mode):
        environment = {**os.environ, "PATH": str(binaries) + os.pathsep + os.environ["PATH"],
                       "INSTALL_TEST_LOG": str(log), "INSTALL_TEST_MODE": mode}
        result = subprocess.run([shutil.which("bash"), str(script), "staging", sha,
                                 str(archive), str(environment_file), "qa"],
                                env=environment, capture_output=True, text=True, timeout=20)
        calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
        return result, calls
    return root, old, run


def test_success_promotes_candidate_only_after_attachment_and_readiness(install_harness):
    root, old, run = install_harness
    result, calls = run("success")
    assert result.returncode == 0, result.stderr
    assert (root / "current-staging").resolve() != old
    assert (root / "current-staging.sha").read_text() == "a" * 40 + "\n"
    assert [call["program"] for call in calls if call["program"] in ("admin-python", "curl")] == ["admin-python", "curl"]


@pytest.mark.parametrize("mode", ["attachment-fails", "readiness-fails"])
def test_failed_candidate_restores_old_backend_using_repaired_attachment_helper(install_harness, mode):
    root, old, run = install_harness
    result, calls = run(mode)
    assert result.returncode == 1
    assert (root / "current-staging").resolve() == old
    assert (root / "current-staging.sha").read_text() == "old-sha\n"
    helper_calls = [call for call in calls if call["program"] == "admin-python"]
    assert len(helper_calls) == 2
    assert helper_calls[0]["args"] == helper_calls[1]["args"]
    assert str(old) not in helper_calls[1]["args"][0]
    assert "previous release restored and ready" in result.stderr


def test_failed_rollback_is_reported_without_promoting_candidate(install_harness):
    root, old, run = install_harness
    result, calls = run("rollback-fails")
    assert result.returncode == 1
    assert "registered Odoo attachment/check failed" in result.stderr
    assert "rollback did not become ready" in result.stderr
    assert (root / "current-staging").resolve() == old


def test_unprotected_old_backend_is_never_restarted(install_harness):
    root, old, run = install_harness
    (old / "backend/app/control.py").unlink()
    result, calls = run("attachment-fails")
    assert result.returncode == 1
    assert "Refusing rollback to the old unauthenticated API" in result.stderr
    assert len([call for call in calls if call["program"] == "admin-python"]) == 1
