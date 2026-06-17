# Build brief — Daily word/logic puzzle

- **Slug:** `wordle`
- **Generated:** 2026-06-16
- **Scout score:** 22.30

## Core hook
One shared puzzle a day; shareable spoiler-free result; streaks.

## Requirements (every Factory game)
- Single self-contained folder `games/wordle/` (index.html + game.js + style.css).
- Mobile-first: works with touch AND keyboard; responsive square canvas.
- Use `shared/juice.js` (sound, particles, screenshake, popups) and `shared/retention.js` (best score, daily streak).
- Expose a `window.__wordle` test hook ({move/act, state, reset}) for the playtest stage.
- No external CDNs required to run; no build step; no secrets.

## Why this scored well
- portal_fit: 3/5
- simplicity: 4/5
- retention: 5/5
- mobile_fit: 5/5
- freshness: 3/5
