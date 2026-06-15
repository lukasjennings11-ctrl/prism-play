#!/usr/bin/env python3
"""Tiny static file server with no-cache headers, for local playtesting.

`python -m http.server` caches aggressively, which means edits don't show up on
reload. Every game is plain static files, so this just serves the repo root with
`Cache-Control: no-store` so the preview/playtest loop always sees the latest code.

Usage:
    python3 factory/serve.py [port] [root]
Defaults: port 8000, root = repo root (the parent of this file's directory).
"""
import http.server
import os
import sys

ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    print("serving %s at http://localhost:%d (no-cache)" % (ROOT, PORT))
    http.server.HTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
