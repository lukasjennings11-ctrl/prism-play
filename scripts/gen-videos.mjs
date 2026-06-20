import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT = join(ROOT, 'covers/portal/videos');
mkdirSync(OUT, { recursive: true });

const CHROME = '/Users/LukasJennings/.cache/puppeteer/chrome/mac-148.0.7778.97/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const BASE = process.env.BASE || 'http://localhost:8123';
const CAPTURE_MS = 15000;

const ORIENTS = [
  { name: 'landscape', w: 1280, h: 720 },
  { name: 'portrait',  w: 720,  h: 1280 },
];

// per-game scripted input to produce visible motion
async function drive(page, slug, deadline) {
  const vp = page.viewport();
  const cx = vp.width / 2, cy = vp.height / 2;
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  while (Date.now() < deadline) {
    try {
      switch (slug) {
        case 'fuse':
          await page.keyboard.press(keys[(Math.random() * 4) | 0]); await sleep(420); break;
        case 'runner':
          await page.keyboard.press(Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight'); await sleep(380); break;
        case 'stack':
          await page.keyboard.press('Space'); await sleep(650); break;
        case 'equate': {
          const rows = [['1','2','+','4','=','1','6'], ['9','-','3','=','6','+','0'], ['8','/','2','=','4','+','0']];
          for (const row of rows) { for (const c of row) { await page.keyboard.press(c).catch(()=>{}); await sleep(160);} await page.keyboard.press('Enter').catch(()=>{}); await sleep(700);} break;
        }
        case 'idle':
          await page.mouse.click(cx, cy); await sleep(110); break;
        case 'orbit':
          await page.mouse.click(rnd(vp.width*0.25, vp.width*0.75), vp.height*0.18); await sleep(750); break;
        case 'bubble':
          await page.mouse.click(rnd(vp.width*0.2, vp.width*0.8), vp.height*0.2); await sleep(620); break;
        case 'io':
          await page.mouse.move(cx + Math.cos(Date.now()/400)*vp.width*0.3, cy + Math.sin(Date.now()/400)*vp.height*0.3); await sleep(60); break;
        case 'td':
          await page.mouse.click(rnd(vp.width*0.2, vp.width*0.8), rnd(vp.height*0.3, vp.height*0.7)); await sleep(550); break;
        case 'match3':
          await page.mouse.click(rnd(vp.width*0.2, vp.width*0.8), rnd(vp.height*0.3, vp.height*0.7)); await sleep(450); break;
        case 'kickle': {
          // focus the search field, type a name to trigger the autocomplete dropdown, pick it
          await page.evaluate(() => { const i = document.querySelector('input'); if (i) i.focus(); }).catch(()=>{});
          for (const name of ['messi', 'haaland', 'kane']) {
            await page.evaluate(() => { const i = document.querySelector('input'); if (i) i.value = ''; }).catch(()=>{});
            for (const c of name) { await page.keyboard.type(c).catch(()=>{}); await sleep(180); }
            await sleep(900);
            await page.keyboard.press('Enter').catch(()=>{});
            await sleep(1200);
          }
          break;
        }
        default:
          await page.keyboard.press(keys[(Math.random()*4)|0]); await sleep(400);
      }
    } catch { await sleep(200); }
  }
}

async function capture(browser, slug, o) {
  const page = await browser.newPage();
  await page.setViewport({ width: o.w, height: o.h, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/games/${slug}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200)); // settle / start screen

  // try to dismiss any start overlay with a click/space
  try { await page.mouse.click(o.w/2, o.h/2); } catch {}
  try { await page.keyboard.press('Space'); } catch {}

  const frameDir = join(OUT, `_frames_${slug}_${o.name}`);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  // Fixed-interval screenshots: guarantees enough frames even for static games
  // (CDP screencast only emits on visual change, which starves text-input games).
  const FPS = 15;
  const interval = 1000 / FPS;
  const t0 = Date.now();
  const deadline = t0 + CAPTURE_MS;
  let n = 0, stop = false;

  // drive input concurrently with capture
  const driving = drive(page, slug, deadline).catch(() => {});

  while (Date.now() < deadline && !stop) {
    const tick = Date.now();
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
      writeFileSync(join(frameDir, `f${String(n++).padStart(4,'0')}.jpg`), buf);
    } catch { stop = true; break; }
    const wait = interval - (Date.now() - tick);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  await driving;
  const fps = FPS;
  await page.close().catch(()=>{});

  if (n < 5) { console.log(`  ⚠ ${slug}/${o.name}: only ${n} frames`); rmSync(frameDir, {recursive:true,force:true}); return; }

  const mp4 = join(OUT, `${slug}-${o.name}.mp4`);
  // pad to even dims, h264, yuv420p for broad compatibility, cap 18s
  execFileSync(ffmpegPath, [
    '-y', '-framerate', String(fps), '-i', join(frameDir, 'f%04d.jpg'),
    '-t', '18',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
    '-movflags', '+faststart', mp4,
  ], { stdio: 'pipe' });
  rmSync(frameDir, { recursive: true, force: true });
  console.log(`  ✓ ${slug}/${o.name}  (${n} frames @ ${fps}fps)`);
}

const only = process.argv[2];
const ALL = ['fuse','stack','orbit','match3','bubble','idle','io','runner','equate','td','kickle'];
const slugs = only ? [only] : ALL;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--mute-audio','--hide-scrollbars'],
});

for (const slug of slugs) {
  console.log(`▶ ${slug}`);
  for (const o of ORIENTS) {
    try { await capture(browser, slug, o); }
    catch (e) { console.log(`  ✗ ${slug}/${o.name}: ${e.message.split('\n')[0]}`); }
  }
}
await browser.close();
console.log('\nDone. Videos in covers/portal/videos/');
