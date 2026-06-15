#!/usr/bin/env python3
"""Scout — rank portal-friendly game concepts and emit a build brief.

The "scout" stage of the Game Factory. It scores a curated catalog of web-game
mechanics on the things that actually matter for a faceless, no-audience start
(portal fit, build simplicity, retention, mobile fit, low saturation),
deprioritizes genres already built in games/, and writes the top pick as a brief
the build stage can act on.

This is deliberately a transparent heuristic, not a black box: edit CATALOG to
change what the factory chases. Run with --seed N to shuffle ties / vary picks.

Usage:
    python3 factory/scout.py [--seed N] [--top K] [--json]
"""
import argparse
import datetime
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES_DIR = os.path.join(ROOT, "games")
REPORTS_DIR = os.path.join(ROOT, "reports")

# Each concept scored 1-5 on: portal_fit, simplicity, retention, mobile_fit, freshness
# (freshness = inverse of saturation; higher = less of a cloned race-to-the-bottom).
CATALOG = [
    {"slug": "merge", "name": "Number/orb merge (2048-family)",
     "portal_fit": 5, "simplicity": 5, "retention": 5, "mobile_fit": 5, "freshness": 2,
     "hook": "Swipe to merge matching tiles; chase a high score and a daily streak."},
    {"slug": "suika", "name": "Physics merge (drop-and-fuse fruit)",
     "portal_fit": 5, "simplicity": 3, "retention": 5, "mobile_fit": 5, "freshness": 4,
     "hook": "Drop orbs into a jar; same-size ones fuse; don't overflow."},
    {"slug": "stack", "name": "Timing stack / tower",
     "portal_fit": 4, "simplicity": 5, "retention": 4, "mobile_fit": 5, "freshness": 3,
     "hook": "One tap to drop a moving block; misalignment trims it; how high can you go?"},
    {"slug": "runner", "name": "One-tap endless dodge/runner",
     "portal_fit": 4, "simplicity": 4, "retention": 4, "mobile_fit": 5, "freshness": 3,
     "hook": "Tap to switch lanes/jump; survive escalating speed; near-miss combos."},
    {"slug": "idle", "name": "Idle / incremental clicker",
     "portal_fit": 4, "simplicity": 4, "retention": 5, "mobile_fit": 4, "freshness": 3,
     "hook": "Click to earn, buy upgrades, watch numbers grow; offline progress pulls players back."},
    {"slug": "io", "name": ".io-style arena (single-player vs bots)",
     "portal_fit": 5, "simplicity": 2, "retention": 4, "mobile_fit": 4, "freshness": 4,
     "hook": "Grow by eating; dodge bigger blobs; quick rounds, instant restart."},
    {"slug": "wordle", "name": "Daily word/logic puzzle",
     "portal_fit": 3, "simplicity": 4, "retention": 5, "mobile_fit": 5, "freshness": 3,
     "hook": "One shared puzzle a day; shareable spoiler-free result; streaks."},
    {"slug": "match3", "name": "Match-3 / swap",
     "portal_fit": 5, "simplicity": 3, "retention": 5, "mobile_fit": 5, "freshness": 2,
     "hook": "Swap to line up 3+; cascading combos; level goals."},
]

WEIGHTS = {"portal_fit": 1.3, "simplicity": 1.1, "retention": 1.2, "mobile_fit": 1.0, "freshness": 1.0}


def built_genres():
    """Genres already shipped — read each game's meta.json ({"genre": ...}),
    falling back to the folder name. Lets the factory chase variety instead of
    rebuilding the same genre under a different brand name."""
    genres = set()
    if not os.path.isdir(GAMES_DIR):
        return genres
    for d in os.listdir(GAMES_DIR):
        gd = os.path.join(GAMES_DIR, d)
        if not os.path.isdir(gd) or d.startswith("."):
            continue
        genre = d
        meta = os.path.join(gd, "meta.json")
        if os.path.isfile(meta):
            try:
                with open(meta) as f:
                    genre = json.load(f).get("genre", d)
            except (ValueError, OSError):
                pass
        genres.add(genre)
    return genres


def score(concept, built):
    base = sum(concept[k] * w for k, w in WEIGHTS.items())
    # heavy penalty if we already shipped this exact genre — chase variety
    if concept["slug"] in built:
        base *= 0.4
    return round(base, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--top", type=int, default=3)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    built = built_genres()

    ranked = sorted(
        CATALOG,
        key=lambda c: (score(c, built), rng.random()),
        reverse=True,
    )
    for c in ranked:
        c["score"] = score(c, built)
        c["already_built"] = c["slug"] in built

    top = ranked[: args.top]
    pick = top[0]

    if args.json:
        print(json.dumps({"built": sorted(built), "ranked": top}, indent=2))
        return

    print("Scout — already built: %s\n" % (", ".join(sorted(built)) or "(none)"))
    print("Ranked concepts:")
    for i, c in enumerate(ranked, 1):
        flag = "  (built)" if c["already_built"] else ""
        print("  %d. %-38s score %.2f%s" % (i, c["name"], c["score"], flag))

    os.makedirs(REPORTS_DIR, exist_ok=True)
    date = datetime.date.today().isoformat()
    brief_path = os.path.join(REPORTS_DIR, "brief_%s_%s.md" % (date, pick["slug"]))
    with open(brief_path, "w") as f:
        f.write("# Build brief — %s\n\n" % pick["name"])
        f.write("- **Slug:** `%s`\n- **Generated:** %s\n- **Scout score:** %.2f\n\n"
                % (pick["slug"], date, pick["score"]))
        f.write("## Core hook\n%s\n\n" % pick["hook"])
        f.write("## Requirements (every Factory game)\n"
                "- Single self-contained folder `games/%s/` (index.html + game.js + style.css).\n"
                "- Mobile-first: works with touch AND keyboard; responsive square canvas.\n"
                "- Use `shared/juice.js` (sound, particles, screenshake, popups) and "
                "`shared/retention.js` (best score, daily streak).\n"
                "- Expose a `window.__%s` test hook ({move/act, state, reset}) for the playtest stage.\n"
                "- No external CDNs required to run; no build step; no secrets.\n\n" % (pick["slug"], pick["slug"]))
        f.write("## Why this scored well\n")
        for k in ("portal_fit", "simplicity", "retention", "mobile_fit", "freshness"):
            f.write("- %s: %d/5\n" % (k, pick[k]))
    print("\nNext build: %s  ->  brief written to %s"
          % (pick["name"], os.path.relpath(brief_path, ROOT)))


if __name__ == "__main__":
    main()
