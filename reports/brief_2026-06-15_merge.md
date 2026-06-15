# Build brief — Number/orb merge (2048-family)

- **Slug:** `merge`
- **Generated:** 2026-06-15
- **Scout score:** 25.00

## Core hook
Swipe to merge matching tiles; chase a high score and a daily streak.

## Requirements (every Factory game)
- Single self-contained folder `games/merge/` (index.html + game.js + style.css).
- Mobile-first: works with touch AND keyboard; responsive square canvas.
- Use `shared/juice.js` (sound, particles, screenshake, popups) and `shared/retention.js` (best score, daily streak).
- Expose a `window.__merge` test hook ({move/act, state, reset}) for the playtest stage.
- No external CDNs required to run; no build step; no secrets.

## Why this scored well
- portal_fit: 5/5
- simplicity: 5/5
- retention: 5/5
- mobile_fit: 5/5
- freshness: 2/5
