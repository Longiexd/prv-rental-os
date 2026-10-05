"""Credential-free Odoo reachability probe executed inside the API container."""
import socket
import sys
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def probe(url, attempts=6, interval=2):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    reason = "Odoo is unavailable"
    for attempt in range(attempts):
        try:
            with opener.open(url, timeout=5) as response:
                if response.status == 200:
                    return
                reason = f"Odoo health returned HTTP {response.status}"
        except urllib.error.HTTPError as error:
            reason = f"Odoo health returned HTTP {error.code}"
            error.close()
        except urllib.error.URLError as error:
            cause = error.reason
            reason = ("Odoo hostname could not be resolved" if isinstance(cause, socket.gaierror)
                      else "Odoo connection timed out" if isinstance(cause, TimeoutError)
                      else "Odoo connection was refused" if isinstance(cause, ConnectionRefusedError)
                      else "Odoo connection failed")
        except TimeoutError:
            reason = "Odoo connection timed out"
        except Exception:
            # Never expose a response body, URL, proxy configuration or traceback.
            reason = "Odoo health probe failed"
        if attempt + 1 < attempts:
            time.sleep(interval)
    raise RuntimeError(reason)


if __name__ == "__main__":
    try:
        probe(sys.argv[1])
    except (RuntimeError, IndexError) as error:
        print(str(error) if isinstance(error, RuntimeError) else "Missing Odoo health target", file=sys.stderr)
        sys.exit(1)
