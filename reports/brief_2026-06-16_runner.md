# Build brief — One-tap endless dodge/runner

- **Slug:** `runner`
- **Generated:** 2026-06-16
- **Scout score:** 22.40

## Core hook
Tap to switch lanes/jump; survive escalating speed; near-miss combos.

## Requirements (every Factory game)
- Single self-contained folder `games/runner/` (index.html + game.js + style.css).
- Mobile-first: works with touch AND keyboard; responsive square canvas.
- Use `shared/juice.js` (sound, particles, screenshake, popups) and `shared/retention.js` (best score, daily streak).
- Expose a `window.__runner` test hook ({move/act, state, reset}) for the playtest stage.
- No external CDNs required to run; no build step; no secrets.

## Why this scored well
- portal_fit: 4/5
- simplicity: 4/5
- retention: 4/5
- mobile_fit: 5/5
- freshness: 3/5
