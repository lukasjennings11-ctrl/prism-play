# The Game Factory

A faceless, repeatable pipeline that builds small, polished HTML5 web games, ships them to the
game **portals** (itch.io, CrazyGames, Poki, GameDistribution) — which bring the players and pay a
revenue share — and doubles down on whatever gets traction. Built with Claude Code agents + loops.

> **Honest expectations:** this is a low-cost, high-variance venture, not a salary. Most individual
> games earn little; the strategy is a *portfolio* where one breakout funds the rest. It's the fun,
> capped, creative sandbox **alongside** the real wealth fundamentals — never instead of them.

## Why games (given a faceless, no-audience start)

Distribution is the hard part when you have no audience. The web-game portals *are* the
distribution: you submit a game, they show it to their existing players, and you earn an ad
revenue share. No face, no following, no paid user-acquisition required.

## Layout

```
games/
├── factory/          # the agent + loop pipeline (Python 3.9 orchestrator)
│   ├── scout.py      # research trending genres → ranked concept briefs
│   ├── playtest.py   # headless QA harness (loads each game, checks for errors)
│   └── ship.py       # assemble a portal submission package
├── games/<slug>/     # one self-contained game per folder (index.html + game.js)
├── shared/           # reused by every game:
│   ├── juice.js      #   game-feel: SFX, particles, screenshake, popups, haptics
│   └── retention.js  #   stickiness: best score, daily streak, daily-seed RNG
└── reports/          # per-cycle notes: shipped, portal status, what to double down on
```

## Run a game locally

No build step and no Node required. Serve the folder and open a game:

```bash
cd ~/games
python3 factory/serve.py        # no-cache static server on :8000
# then open http://localhost:8000/games/fuse/  (or http://localhost:8000/ for the arcade)
```

## Games

| Slug | Genre | Status |
|------|-------|--------|
| `fuse` | merge puzzle (2048-family) | playable — pipeline proof |

## Pipeline (agents + loops)

1. **Scout** trending, portal-friendly genres → a ranked brief.
2. **Build** a complete, mobile-first game from the brief (uses `shared/`).
3. **Playtest** it headlessly (loads clean, responsive, no console errors).
4. **Monetize** via the portal SDK (rewarded video) when shipping to a portal.
5. **Ship** to itch.io first (always-open), then submit to the curated portals.
6. **Measure** portal analytics weekly → double down on winners, kill the rest.
