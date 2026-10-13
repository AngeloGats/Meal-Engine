"""Small dependency-free local web server for the meal-plan screener."""

from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from engine import RULES, evaluate_plan


HOST = "127.0.0.1"
PORT = 8000
WEB_ROOT = Path(__file__).resolve().parent / "web"
MAX_REQUEST_BYTES = 512_000


class MealPlanHandler(BaseHTTPRequestHandler):
    server_version = "MealPlanScreener/1.0"

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/guidelines":
            self._send_json({"source": "NNC Governing Board Resolution No. 6, s. 2012", "rules": RULES})
            return
        if path == "/":
            path = "/index.html"

        assets = {
            "/index.html": "index.html",
            "/styles.css": "styles.css",
            "/app.js": "app.js",
        }
        filename = assets.get(path)
        if filename is None:
            self.send_error(404, "Not found")
            return
        asset_path = (WEB_ROOT / filename).resolve()
        if WEB_ROOT.resolve() not in asset_path.parents:
            self.send_error(404, "Not found")
            return
        try:
            content = asset_path.read_bytes()
        except FileNotFoundError:
            self.send_error(404, "Not found")
            return
        content_type = mimetypes.guess_type(asset_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/evaluate":
            self.send_error(404, "Not found")
            return
        content_type = self.headers.get_content_type()
        if content_type != "application/json":
            self._send_json({"error": "Content-Type must be application/json."}, status=415)
            return
        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._send_json({"error": "A valid Content-Length header is required."}, status=411)
            return
        if content_length < 0:
            self._send_json({"error": "Content-Length cannot be negative."}, status=400)
            return
        if content_length > MAX_REQUEST_BYTES:
            self._send_json({"error": "Request body is too large."}, status=413)
            return
        try:
            body = self.rfile.read(content_length)
            plan: Any = json.loads(body)
            result = evaluate_plan(plan)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json({"error": "Request body must contain valid UTF-8 JSON."}, status=400)
            return
        except ValueError as error:
            self._send_json({"error": str(error)}, status=400)
            return
        self._send_json(result)

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), MealPlanHandler)
    print(f"Meal-plan screener running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping meal-plan screener.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
