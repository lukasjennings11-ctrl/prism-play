#!/usr/bin/env python3
"""Playtest — automated pre-flight checks for a game before the live MCP playtest.

The deep "is it fun / does it render" check is done by driving the game in a real
browser via the Claude Preview MCP. This script is the cheap gate that runs first:
it catches the boring, common breakages (missing files, broken asset paths, no
viewport meta, missing shared libs or test hook) and, if the dev server is up,
confirms the game and its assets actually serve over HTTP.

Exit code is non-zero if any check fails, so it can gate the pipeline.

Usage:
    python3 factory/playtest.py <slug> [--port 8000]
"""
import argparse
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    gdir = os.path.join(ROOT, "games", args.slug)
    passed, failed = [], []

    def check(ok, label):
        (passed if ok else failed).append(label)

    # --- structural ---
    check(os.path.isdir(gdir), "game folder exists")
    index_path = os.path.join(gdir, "index.html")
    check(os.path.isfile(index_path), "index.html present")
    check(os.path.isfile(os.path.join(gdir, "game.js")), "game.js present")

    html = ""
    if os.path.isfile(index_path):
        with open(index_path) as f:
            html = f.read()
        check("viewport" in html, "has viewport meta (mobile)")
        check("shared/juice.js" in html, "includes shared/juice.js")
        check("shared/retention.js" in html, "includes shared/retention.js")

        # every referenced local src/href resolves on disk
        refs = re.findall(r'(?:src|href)="([^"]+)"', html)
        for ref in refs:
            if ref.startswith(("http://", "https://", "data:", "#")):
                continue
            clean = ref.split("?", 1)[0].split("#", 1)[0]
            target = os.path.normpath(os.path.join(gdir, clean))
            check(os.path.isfile(target), "asset resolves: %s" % ref)

    gjs = os.path.join(gdir, "game.js")
    if os.path.isfile(gjs):
        with open(gjs) as f:
            js = f.read()
        check(re.search(r"window\.__\w+\s*=", js) is not None,
              "exposes a window.__<slug> test hook")

    # --- HTTP smoke (only if the dev server is running) ---
    base = "http://localhost:%d" % args.port
    url = "%s/games/%s/" % (base, args.slug)
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            check(r.status == 200, "HTTP 200 for %s" % url)
        for asset in ("shared/juice.js", "shared/retention.js"):
            with urllib.request.urlopen("%s/%s" % (base, asset), timeout=2) as r:
                check(r.status == 200, "HTTP 200 for /%s" % asset)
    except (urllib.error.URLError, OSError):
        print("(dev server not running on :%d — skipping HTTP smoke; "
              "run `python3 factory/serve.py` to enable)\n" % args.port)

    # --- report ---
    for label in passed:
        print("  PASS  %s" % label)
    for label in failed:
        print("  FAIL  %s" % label)
    print("\n%d passed, %d failed" % (len(passed), len(failed)))
    if failed:
        print("\nNot ready: fix the failures above, then run the live MCP playtest "
              "(load the game in the preview, check console, drive the __hook).")
        sys.exit(1)
    print("\nPre-flight OK. Next: live playtest in the browser preview "
          "(screenshot + console + drive window.__%s)." % args.slug)


if __name__ == "__main__":
    main()
