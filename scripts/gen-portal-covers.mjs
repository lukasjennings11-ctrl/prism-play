import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '../covers/portal');
mkdirSync(OUT, { recursive: true });

// Per-game style: bg, bg2 (gradient), accent, title, genre label
const GAMES = {
  fuse:   { bg:'#080d1e', bg2:'#0d1530', accent:'#5b8cff', title:'Fuse',       genre:'MERGE PUZZLE' },
  stack:  { bg:'#08160c', bg2:'#0d2214', accent:'#4eff91', title:'Stack',      genre:'TOWER ARCADE' },
  orbit:  { bg:'#081a18', bg2:'#0d2420', accent:'#4fe0c8', title:'Orbit',      genre:'PHYSICS MERGE' },
  match3: { bg:'#0e0820', bg2:'#160d30', accent:'#c678f0', title:'Gem Drop',   genre:'MATCH-3' },
  bubble: { bg:'#08181f', bg2:'#0d2430', accent:'#38d4f5', title:'Burst',      genre:'BUBBLE SHOOTER' },
  idle:   { bg:'#1a1008', bg2:'#261808', accent:'#ffb347', title:'Coin Forge', genre:'IDLE CLICKER' },
  io:     { bg:'#081a14', bg2:'#0d261c', accent:'#3ee6b8', title:'Splat',      genre:'IO ARENA' },
  runner: { bg:'#08161f', bg2:'#0d2030', accent:'#4fd6ff', title:'Dash Lanes', genre:'ENDLESS RUNNER' },
  equate: { bg:'#081a18', bg2:'#0d2420', accent:'#4fe0c8', title:'Equate',     genre:'DAILY MATH' },
  td:     { bg:'#091a0d', bg2:'#0d2614', accent:'#5ef79b', title:'Outpost',    genre:'TOWER DEFENSE' },
  kickle: { bg:'#051a0a', bg2:'#0a2410', accent:'#3df57a', title:'Kickle',     genre:'DAILY PUZZLE' },
};

const SIZES = [
  { name:'landscape', w:1920, h:1080 },
  { name:'portrait',  w:800,  h:1200 },
  { name:'square',    w:800,  h:800  },
];

// deterministic pseudo-random for particle placement
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function svg(g, w, h) {
  const rnd = mulberry32(w * 7 + h * 13 + g.title.length);
  const cx = w / 2, cy = h * 0.40;
  const k = Math.min(w, h);

  // floating rounded tiles motif (prism play vibe)
  let tiles = '';
  const N = 7;
  for (let i = 0; i < N; i++) {
    const ts = k * (0.05 + rnd() * 0.07);
    const tx = rnd() * w, ty = rnd() * h;
    const op = 0.06 + rnd() * 0.10;
    const rot = (rnd() * 40 - 20).toFixed(1);
    tiles += `<rect x="${(tx-ts/2).toFixed(1)}" y="${(ty-ts/2).toFixed(1)}" width="${ts.toFixed(1)}" height="${ts.toFixed(1)}" rx="${(ts*0.22).toFixed(1)}" fill="${g.accent}" opacity="${op.toFixed(2)}" transform="rotate(${rot} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`;
  }

  // central emblem: stacked rounded squares (a "prism" tile cluster)
  const e = k * 0.16;
  const emblem = `
    <g transform="translate(${cx} ${cy})">
      <rect x="${(-e*0.95).toFixed(1)}" y="${(-e*0.95).toFixed(1)}" width="${(e*1.9).toFixed(1)}" height="${(e*1.9).toFixed(1)}" rx="${(e*0.3).toFixed(1)}" fill="${g.accent}" opacity="0.12"/>
      <rect x="${(-e*0.62).toFixed(1)}" y="${(-e*0.62).toFixed(1)}" width="${(e*1.24).toFixed(1)}" height="${(e*1.24).toFixed(1)}" rx="${(e*0.24).toFixed(1)}" fill="${g.accent}" opacity="0.28"/>
      <rect x="${(-e*0.34).toFixed(1)}" y="${(-e*0.34).toFixed(1)}" width="${(e*0.68).toFixed(1)}" height="${(e*0.68).toFixed(1)}" rx="${(e*0.18).toFixed(1)}" fill="${g.accent}"/>
    </g>`;

  const titleSize = k * 0.115;
  const genreSize = k * 0.034;
  const wmSize = k * 0.028;
  const titleY = cy + e * 1.5 + titleSize * 0.85;
  const genreY = titleY + titleSize * 0.55;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="bgr" cx="50%" cy="38%" r="70%">
        <stop offset="0%" stop-color="${g.bg2}"/>
        <stop offset="100%" stop-color="${g.bg}"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="38%" r="48%">
        <stop offset="0%" stop-color="${g.accent}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${g.accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bgr)"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    ${tiles}
    ${emblem}
    <text x="${cx}" y="${titleY.toFixed(1)}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${titleSize.toFixed(1)}" font-weight="800" fill="#eef2ff" letter-spacing="-1">${g.title}</text>
    <text x="${cx}" y="${genreY.toFixed(1)}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${genreSize.toFixed(1)}" font-weight="700" letter-spacing="4" fill="${g.accent}">${g.genre}</text>
    <text x="${(w/2).toFixed(1)}" y="${(h-k*0.045).toFixed(1)}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${wmSize.toFixed(1)}" font-weight="900" letter-spacing="3" fill="#ffffff" opacity="0.30">PRISM PLAY</text>
  </svg>`);
}

const only = process.argv[2]; // optional slug
let count = 0;
for (const [slug, g] of Object.entries(GAMES)) {
  if (only && slug !== only) continue;
  for (const s of SIZES) {
    const file = join(OUT, `${slug}-${s.name}-${s.w}x${s.h}.png`);
    await sharp(svg(g, s.w, s.h)).png().toFile(file);
    count++;
  }
  console.log(`✓ ${slug} (3 sizes)`);
}
console.log(`\nDone — ${count} cover images in covers/portal/`);
