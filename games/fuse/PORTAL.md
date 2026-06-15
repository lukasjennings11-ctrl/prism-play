# Fuse — portal status

| Portal | Status | Notes |
|--------|--------|-------|
| itch.io | not submitted | First target — accepts the plain `dist/fuse.zip` as HTML game. |
| CrazyGames | not submitted | Integrate CrazyGames SDK (rewarded video) before submitting for rev-share. |
| GameDistribution / Playgama | not submitted | One build → many portals via Playgama Bridge. |

## To ship
1. `python3 factory/ship.py fuse` → `dist/fuse.zip` + `dist/fuse/SUBMISSION.md`.
2. Fill in `SUBMISSION.md` (tagline + description).
3. Upload to itch.io (Kind: HTML, mobile-friendly, viewport ~520×760).
4. Record the live URL + date here once accepted.

## Monetization (added before curated-portal submission)
- [ ] CrazyGames SDK: init + rewarded-video on "Play again".
- [ ] Interstitial on game-over (frequency-capped).
- [ ] Playgama Bridge for multi-portal publish (~80% rev keep).
