#!/usr/bin/env python3
"""Ship — assemble a self-contained, portal-ready package for a game.

Games live in games/<slug>/ and reference the repo's shared libs via
`../../shared/...`, which won't exist inside a zip of one game folder. This stage
bundles a standalone copy: it inlines the referenced shared files into
dist/<slug>/shared/, rewrites the paths, copies local assets, writes a submission
metadata template (title/tagline/controls/tags), and zips it for upload to
itch.io / CrazyGames / GameDistribution.

Usage:
    python3 factory/ship.py <slug>
Output:
    dist/<slug>/        self-contained game
    dist/<slug>.zip     ready to upload
    dist/<slug>/SUBMISSION.md   copy-paste metadata for the portal forms
"""
import argparse
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    args = ap.parse_args()
    slug = args.slug

    src = os.path.join(ROOT, "games", slug)
    if not os.path.isfile(os.path.join(src, "index.html")):
        print("No games/%s/index.html — nothing to ship." % slug)
        sys.exit(1)

    out = os.path.join(ROOT, "dist", slug)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "shared"), exist_ok=True)

    with open(os.path.join(src, "index.html")) as f:
        html = f.read()

    # copy local files (everything in the game folder except PORTAL.md notes)
    for name in os.listdir(src):
        sp = os.path.join(src, name)
        if name in ("PORTAL.md",):
            continue
        if os.path.isdir(sp):
            shutil.copytree(sp, os.path.join(out, name))
        elif name != "index.html":
            shutil.copy2(sp, os.path.join(out, name))

    # inline referenced shared libs and rewrite ../../shared/ -> shared/
    for ref in re.findall(r'(?:src|href)="(\.\./\.\./shared/[^"]+)"', html):
        base = os.path.basename(ref.split("?", 1)[0])
        shutil.copy2(os.path.join(ROOT, "shared", base), os.path.join(out, "shared", base))
    html = html.replace("../../shared/", "shared/")
    with open(os.path.join(out, "index.html"), "w") as f:
        f.write(html)

    # submission metadata template
    title = slug.capitalize()
    sub = os.path.join(out, "SUBMISSION.md")
    with open(sub, "w") as f:
        f.write("# %s — portal submission\n\n" % title)
        f.write("**Title:** %s\n\n" % title)
        f.write("**Tagline:** <one punchy line — fill in>\n\n")
        f.write("**Controls:** Swipe / arrow keys (mobile + desktop).\n\n")
        f.write("**Tags:** puzzle, casual, mobile, hypercasual, highscore\n\n")
        f.write("**Description:**\n<2-3 sentences. What you do, the one-more-go hook, the goal.>\n\n")
        f.write("## Where to upload\n")
        f.write("- itch.io  (Kind: HTML, check 'mobile friendly', set viewport ~520x720, upload %s.zip)\n" % slug)
        f.write("- CrazyGames developer portal (HTML5; add their SDK for rev-share before submitting)\n")
        f.write("- GameDistribution / Playgama Bridge (one build to many portals)\n\n")
        f.write("> Reminder: integrate a portal SDK's rewarded-video before monetized submission; "
                "itch.io accepts the plain zip as-is for the first real-world signal.\n")

    # zip it
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    zpath = os.path.join(ROOT, "dist", slug + ".zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(out):
            for fn in files:
                fp = os.path.join(base, fn)
                z.write(fp, os.path.relpath(fp, out))

    n = sum(len(files) for _, _, files in os.walk(out))
    print("Shipped %s:" % slug)
    print("  %s  (%d files)" % (os.path.relpath(out, ROOT), n))
    print("  %s  (%.1f KB)" % (os.path.relpath(zpath, ROOT), os.path.getsize(zpath) / 1024.0))
    print("  fill in %s, then upload the zip to itch.io first." % os.path.relpath(sub, ROOT))


if __name__ == "__main__":
    main()
