# Build brief — Physics merge (drop-and-fuse fruit)

- **Slug:** `suika`
- **Generated:** 2026-06-15
- **Scout score:** 24.80

## Core hook
Drop orbs into a jar; same-size ones fuse; don't overflow.

## Requirements (every Factory game)
- Single self-contained folder `games/suika/` (index.html + game.js + style.css).
- Mobile-first: works with touch AND keyboard; responsive square canvas.
- Use `shared/juice.js` (sound, particles, screenshake, popups) and `shared/retention.js` (best score, daily streak).
- Expose a `window.__suika` test hook ({move/act, state, reset}) for the playtest stage.
- No external CDNs required to run; no build step; no secrets.

## Why this scored well
- portal_fit: 5/5
- simplicity: 3/5
- retention: 5/5
- mobile_fit: 5/5
- freshness: 4/5
