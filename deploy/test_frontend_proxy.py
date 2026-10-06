"""Exercise the built frontend against a disposable loopback API double.

This verifies frontend behavior, not Odoo. The separate Compose test covers Odoo.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    key, token = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    active = False
    calls = []

    class API(BaseHTTPRequestHandler):
        def log_message(self, *_): pass

        def handle_api(self):
            nonlocal active
            assert self.headers.get("X-Klynx-Proxy-Key") == key
            calls.append((self.command, self.path))
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            status, payload = 200, {"success": True}
            if self.path == "/auth/login":
                assert json.loads(body)["username"] == "atlas.sarah"
                active = True
                payload = {"token": token, "max_age": 28800}
            elif self.path == "/auth/session" and self.command == "DELETE":
                active = False
            elif not active or self.headers.get("X-Klynx-Session") != token:
                status, payload = 401, {"detail": "Please sign in"}
            else:
                payload = {"cars": []}
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())

        do_GET = do_POST = do_DELETE = handle_api

    upstream = ThreadingHTTPServer(("127.0.0.1", 0), API)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    origin = f"http://localhost:{port}"
    environment = {**os.environ, "APP_ENV": "development", "APP_ORIGIN": origin,
                   "NEXT_PUBLIC_API_URL": f"http://127.0.0.1:{upstream.server_port}",
                   "KLYNX_PROXY_KEY": key, "PORT": str(port), "HOST": "127.0.0.1"}
    frontend = Path(__file__).resolve().parents[1] / "frontend"
    log_path = frontend.parent / "frontend-proxy-runtime.log"
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    with log_path.open("w") as log:
        process = subprocess.Popen(["node", "dist/standalone/server.js"], cwd=frontend, env=environment, stdout=log, stderr=log, creationflags=flags)
        def request(method, path, body=None, headers=None):
            req = Request(origin+path, data=body, method=method, headers=headers or {})
            try: response = urlopen(req, timeout=15)
            except HTTPError as error: response = error
            return response.status, response.headers, response.read()
        try:
            for attempt in range(40):
                if process.poll() is not None:
                    raise RuntimeError("Frontend startup failed; inspect frontend-proxy-runtime.log")
                try:
                    request("GET", "/login")
                    break
                except (URLError, ConnectionError):
                    if attempt == 39: raise
                    time.sleep(0.25)
            body = json.dumps({"username": "atlas.sarah", "password": secrets.token_urlsafe(24)}).encode()
            bad = {"Origin": "https://attacker.invalid", "Content-Type": "application/json"}
            assert request("POST", "/api/auth", body, bad)[0] == 403
            assert not calls
            correct = {"Origin": origin, "Content-Type": "application/json"}
            status, response_headers, response_body = request("POST", "/api/auth", body, correct)
            assert status == 200, f"Login handler returned {status}"
            cookie_headers = response_headers.get_all("Set-Cookie")
            cookie = next(value for value in cookie_headers if value.startswith("__Host-klynx_session="))
            for attribute in ("HttpOnly", "Secure", "Path=/"):
                assert attribute.lower() in cookie.lower()
            assert token.encode() not in response_body
            session_headers = {"Cookie": cookie.split(";", 1)[0], "Origin": origin}
            assert request("GET", "/api/backend/cars", headers=session_headers)[0] == 200
            assert request("POST", "/api/backend/cars/sync", b"", session_headers)[0] == 200
            assert request("GET", "/api/backend/auth/session", headers=session_headers)[0] == 404
            assert request("DELETE", "/api/auth", headers=session_headers)[0] == 200
            assert request("GET", "/api/backend/cars", headers=session_headers)[0] == 401
            print("Built frontend: login, private cookie, CSRF, proxy, empty POST, blocked admin paths and logout passed.")
        finally:
            process.terminate()
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.kill(); process.wait()
            upstream.shutdown()


if __name__ == "__main__":
    main()
