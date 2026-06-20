# iOS App Store Submission — Prism Play (11 separate apps)

## What's been done
- 11 Xcode projects generated under `apps/<slug>/ios/`
- Each has its own bundle ID (`com.prismplay.<slug>`)
- Web assets copied with corrected paths

## Step 1 — Create apps in App Store Connect (do this first)

Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → **+** → New App.

Repeat for each of the 11 games:

| Name               | Bundle ID                    | SKU                  |
|--------------------|------------------------------|----------------------|
| Fuse               | com.prismplay.fuse           | prismplay-fuse       |
| Stack              | com.prismplay.stack          | prismplay-stack      |
| Orbit              | com.prismplay.orbit          | prismplay-orbit      |
| Gem Drop           | com.prismplay.gemdrop        | prismplay-gemdrop    |
| Burst              | com.prismplay.burst          | prismplay-burst      |
| Coin Forge         | com.prismplay.coinforge      | prismplay-coinforge  |
| Splat              | com.prismplay.splat          | prismplay-splat      |
| Dash Lanes         | com.prismplay.dashlanes      | prismplay-dashlanes  |
| Equate             | com.prismplay.equate         | prismplay-equate     |
| Outpost            | com.prismplay.outpost        | prismplay-outpost    |
| Kickle             | com.prismplay.kickle         | prismplay-kickle     |

**Settings per app in App Store Connect:**
- Platform: iOS
- Primary language: English (UK) or English (US)
- Category: **Games** → sub-category varies by game (see below)
- Age Rating: **4+** (no violence, no inappropriate content)

### Category per game
| Game       | Primary Category | Secondary |
|------------|-----------------|-----------|
| Fuse       | Games > Puzzle  | Games > Board |
| Stack      | Games > Arcade  | Games > Action |
| Orbit      | Games > Puzzle  | Games > Casual |
| Gem Drop   | Games > Puzzle  | Games > Casual |
| Burst      | Games > Puzzle  | Games > Arcade |
| Coin Forge | Games > Casual  | Games > Simulation |
| Splat      | Games > Arcade  | Games > Action |
| Dash Lanes | Games > Arcade  | Games > Action |
| Equate     | Games > Puzzle  | Games > Word |
| Outpost    | Games > Strategy| Games > Casual |
| Kickle     | Games > Puzzle  | Games > Sports |

---

## Step 2 — Open each app in Xcode and configure signing

For each game (start with Fuse):

```bash
cd ~/games/apps/fuse
npx cap open ios
```

In Xcode:
1. Click the project name at the top of the navigator (left panel)
2. Select **App** target → **Signing & Capabilities** tab
3. **Automatically manage signing** → tick it
4. **Team** → select your Apple Developer account (your name)
5. Xcode will auto-generate provisioning profiles — wait for the "✓" tick

> If you see "No matching provisioning profiles found" — make sure you created the app in App Store Connect first (Step 1) and the bundle ID matches exactly.

---

## Step 3 — Set app version and build number

In Xcode, with the App target selected:
- **General** tab → **Identity**
  - **Version**: `1.0`
  - **Build**: `1`

---

## Step 4 — Set the app icon

All 11 apps need a 1024×1024px icon. Use the covers you generated at `~/games/covers/cover-<slug>.png` (or create a simple square version).

In Xcode:
1. Navigate to `App/App/Assets.xcassets/AppIcon.appiconset/`
2. Drag your 1024×1024 PNG onto the **1024pt** slot
3. Xcode generates all other sizes automatically

For now, the default Capacitor icon works — you can update icons after the first submission.

---

## Step 5 — Archive and upload

In Xcode:
1. Make sure the **destination** (top bar) is set to **Any iOS Device (arm64)** — not a simulator
2. **Product** menu → **Archive**
3. Wait for the archive to build (~1-2 min)
4. When the Organizer window opens → click **Distribute App**
5. Choose: **App Store Connect** → **Upload** → Next
6. Leave all options ticked → Next
7. Click **Upload**

Xcode uploads the binary to App Store Connect. This takes 1-5 minutes.

---

## Step 6 — Complete the app listing in App Store Connect

After the binary uploads, go back to App Store Connect → your app → **App Store** tab → **1.0 Prepare for Submission**.

Fill in per-game:

### Screenshots (required)
- **iPhone 6.9"** (required): 1290×2796px
- **iPad 13"** (optional but recommended)

**Fastest way to get screenshots:** Play each game on your iPhone, take screenshots using the side button + volume up. They count as valid App Store screenshots.

Or use the Xcode Simulator:
1. `npx cap open ios` → run on iPhone 16 Pro Max simulator
2. Screenshot with Cmd+S in Simulator

### App description (copy from PORTAL_SUBMISSIONS.md)
Use the descriptions already in `~/games/dist/PORTAL_SUBMISSIONS.md` for each game.

### Keywords (100 chars)
- Fuse: `merge,2048,tiles,puzzle,swipe,casual,brain,daily,logic,slide`
- Stack: `tower,arcade,stack,tap,reflex,timing,casual,block,balance,quick`
- Orbit: `physics,merge,suika,orbs,stack,puzzle,drop,casual,gravity,jar`
- Gem Drop: `match3,gems,swap,cascade,combo,puzzle,casual,jewel,brain,board`
- Burst: `bubble,shooter,pop,aim,arcade,casual,puzzle,colorful,hex,burst`
- Coin Forge: `idle,clicker,mine,coins,upgrade,casual,incremental,tap,offline`
- Splat: `io,arena,blob,eat,dodge,grow,casual,agar,quick,arcade`
- Dash Lanes: `runner,endless,lanes,dodge,reflex,speed,casual,tap,obstacle`
- Equate: `daily,math,equation,wordle,nerdle,puzzle,logic,brain,number`
- Outpost: `tower,defense,strategy,turret,waves,build,upgrade,casual`
- Kickle: `football,soccer,daily,wordle,guess,player,puzzle,sport,quiz`

### Privacy Policy URL
All games need a privacy policy. Use: `https://ljennings11.itch.io/fuse` (your existing page has a privacy link) or create a simple page on GitHub Pages.

### Support URL
Use your itch.io profile: `https://ljennings11.itch.io`

---

## Step 7 — Submit for review

In App Store Connect → **Add for Review** → **Submit to App Review**.

- Review time: typically **1–3 days** for games
- You'll get an email when approved or if they need changes

---

## Repeat for all 11 apps

Submission order (shortest to longest review risk):
1. **Fuse** (simplest game, lowest risk of rejection)
2. **Equate** (math puzzle, very clean)
3. **Kickle** (sports puzzle)
4. Then remaining 8 in any order

Once Fuse is approved, you know the template works and can submit the rest quickly.

---

## Common rejection reasons (and how to avoid them)

| Reason | Fix |
|--------|-----|
| Missing privacy policy | Add URL in Step 6 |
| App crashes on launch | Test in Xcode Simulator before submitting |
| Metadata mentions competitor names | Don't compare to Wordle/Suika by name in description |
| Icon is too similar to system icons | Use game-specific artwork |
| Guideline 4.2 (minimum functionality) | Each game has unique gameplay — this applies to template apps |

---

## Quick-submit shell script (after Step 1 is done)

Once you've done Fuse manually and know it works, this opens all others in sequence:

```bash
for slug in stack orbit match3 bubble idle io runner equate td kickle; do
  echo "Opening $slug in Xcode..."
  cd ~/games/apps/$slug && npx cap open ios
  echo "Press Enter when done archiving $slug, then proceed to next..."
  read
done
```
