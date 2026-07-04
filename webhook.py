#!/usr/bin/env python3
import http.server, json, subprocess, os, hmac, hashlib
from datetime import datetime

PORT = 9001
DEPLOY_SCRIPT = "/opt/openfront/deploy.sh"
SECRET = os.environ.get("WEBHOOK_SECRET", "")

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        if SECRET:
            sig = self.headers.get("X-Hub-Signature-256", "")
            expected = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected):
                self.send_response(403); self.end_headers(); return
        try:
            payload = json.loads(body)
        except:
            self.send_response(400); self.end_headers(); return
        if payload.get("ref", "") != "refs/heads/main":
            self.send_response(200); self.end_headers(); self.wfile.write(b"Skipped"); return
        print(f"[{datetime.now()}] Push to main, deploying...")
        subprocess.Popen(["bash", DEPLOY_SCRIPT], stdout=open("/opt/openfront/deploy.log", "a"), stderr=subprocess.STDOUT)
        self.send_response(200); self.end_headers(); self.wfile.write(b"Deploying...")
    def log_message(self, fmt, *args):
        print(f"[{datetime.now()}] {fmt % args}")

if __name__ == "__main__":
    print(f"Webhook listener on port {PORT}")
    http.server.HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
