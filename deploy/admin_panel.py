"""Private visual owner controls. Run on the VPS; access over an SSH tunnel."""
import argparse
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
from urllib.parse import parse_qs, urlsplit

from admin import Admin
from app.features import PLANS


def make_handler(admin, key, port):
    nonce = secrets.token_urlsafe(24)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log launch keys, cookies or client information.

        def authenticated(self):
            try:
                cookies = SimpleCookie(self.headers.get("Cookie", ""))
                supplied = cookies["klynx_owner"].value if "klynx_owner" in cookies else ""
                return secrets.compare_digest(supplied.encode(), key.encode())
            except Exception:
                return False

        def host_valid(self):
            return self.headers.get("Host") in {f"localhost:{port}", f"127.0.0.1:{port}"}

        def respond(self, status, data, content_type="application/json"):
            payload = json.dumps(data).encode() if content_type == "application/json" else data.encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", f"default-src 'none'; script-src 'nonce-{nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if not self.host_valid():
                return self.respond(403, {"error": "Private local panel only"})
            url = urlsplit(self.path)
            supplied = parse_qs(url.query).get("key", [""])[0]
            launch = url.path == "/" and secrets.compare_digest(supplied.encode(), key.encode())
            if not self.authenticated() and not launch:
                return self.respond(403, {"error": "Open the private launch link printed on your VPS"})
            if launch:
                # Remove the launch secret from the address bar before showing the page.
                self.send_response(303)
                self.send_header("Location", "/")
                self.send_header("Set-Cookie", f"klynx_owner={key}; HttpOnly; SameSite=Strict; Path=/")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if url.path == "/":
                page = Path(__file__).with_name("admin_panel.html").read_text(encoding="utf-8")
                return self.respond(200, page.replace("__NONCE__", nonce).replace("__CSRF__", key), "text/html")
            if url.path == "/companies":
                control = admin.control()
                with control.db() as db:
                    companies = [dict(row) for row in db.execute("SELECT code,name,status FROM companies ORDER BY name")]
                for company in companies:
                    company.update(control.features(company["code"]))
                return self.respond(200, {"environment": admin.environment, "companies": companies, "plans": PLANS})
            self.respond(404, {"error": "Not found"})

        def do_POST(self):
            if not self.host_valid() or not self.authenticated():
                return self.respond(403, {"error": "Private local panel only"})
            if self.headers.get("Origin") != "http://" + self.headers["Host"] or not secrets.compare_digest(self.headers.get("X-Klynx-CSRF", "").encode(), key.encode()):
                return self.respond(403, {"error": "Invalid request origin"})
            if self.path != "/features" or self.headers.get("Content-Type") != "application/json":
                return self.respond(400, {"error": "Invalid request"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 16384:
                    raise ValueError("Invalid request size")
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or set(body) != {"company", "plan", "overrides"}:
                    raise ValueError("Invalid settings")
                if not isinstance(body["company"], str) or not isinstance(body["plan"], str) or not isinstance(body["overrides"], dict):
                    raise ValueError("Invalid settings")
                with admin.lock():
                    result = admin.control().set_features(body["company"], body["plan"], body["overrides"])
                self.respond(200, result)
            except (ValueError, KeyError, json.JSONDecodeError) as error:
                self.respond(400, {"error": str(error)})
            except (OSError, RuntimeError):
                self.respond(503, {"error": "Settings unavailable. Check private VPS administration."})

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True, choices=["development", "staging", "production"])
    parser.add_argument("--port", type=int, default=8899)
    args = parser.parse_args()
    if os.name != "posix" or os.geteuid() != 0:
        parser.error("Run this private tool as root on the Linux VPS")
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535")
    os.umask(0o077)
    key = secrets.token_urlsafe(32)
    server = HTTPServer(("127.0.0.1", args.port), make_handler(Admin(args.environment), key, args.port))
    print(f"Private {args.environment} owner panel. Use your SSH tunnel; keep this terminal open.", flush=True)
    print(f"Open: http://localhost:{args.port}/?key={key}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
