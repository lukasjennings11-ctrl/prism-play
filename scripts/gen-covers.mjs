import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '../covers');
mkdirSync(OUT, { recursive: true });

const W = 630, H = 500;

// ── Shared helpers ────────────────────────────────────────────────────────────

function chip(x, y, label, accent) {
  const w = label.length * 8.5 + 24;
  return `
    <rect x="${x - w}" y="${y}" width="${w}" height="26" rx="13"
      fill="${accent}" fill-opacity="0.18"/>
    <text x="${x - w/2}" y="${y + 17}" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="12" font-weight="700"
      letter-spacing="1.5" fill="${accent}">${label}</text>`;
}

function wordmark(accent) {
  return `<text x="22" y="34" font-family="system-ui,sans-serif" font-size="17"
    font-weight="900" letter-spacing="2" fill="${accent}" opacity="0.45">PRISM PLAY</text>`;
}

function title(label, genre, muted) {
  return `
    <text x="28" y="${H - 46}" font-family="system-ui,sans-serif" font-size="40"
      font-weight="800" fill="#eef2ff" letter-spacing="-0.5">${label}</text>
    <text x="28" y="${H - 18}" font-family="system-ui,sans-serif" font-size="15"
      font-weight="500" fill="${muted}" letter-spacing="0.3">${genre}</text>`;
}

function bg(bg1, bg2, accent) {
  return `
    <defs>
      <radialGradient id="bgr" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="${bg2}"/>
        <stop offset="100%" stop-color="${bg1}"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="35%" r="50%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bgr)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>`;
}

function particles(seeds, accent, opacity = 0.2) {
  return seeds.map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="${opacity}"/>`
  ).join('');
}

// ── Per-game SVG builders ─────────────────────────────────────────────────────

function svgFuse() {
  const BG = '#080d1e', BG2 = '#0d1530', AC = '#5b8cff', MU = '#8b95bf';
  const tileW = 82, gap = 8, startX = 147, startY = 88;
  const vals = [
    [2,4,8,16],
    [32,64,128,256],
    [4,8,'1024','1024'],
    [2,16,32,'2048'],
  ];
  const tileColor = v => {
    if (v === '2048') return AC;
    if (v === '1024') return '#3a6de0';
    if (v >= 256) return '#2a4db8';
    if (v >= 64) return '#1d3890';
    if (v >= 16) return '#162d7a';
    return '#1b2342';
  };
  let tiles = '';
  vals.forEach((row, r) => {
    row.forEach((v, c) => {
      const x = startX + c * (tileW + gap);
      const y = startY + r * (tileW + gap);
      const col = tileColor(v);
      const isKey = v === '1024' || v === '2048';
      tiles += `<rect x="${x}" y="${y}" width="${tileW}" height="${tileW}" rx="10"
        fill="${col}" ${isKey ? `stroke="${AC}" stroke-width="2.5" stroke-opacity="0.8"` : ''}/>`;
      if (isKey && v === '2048') {
        tiles += `<rect x="${x-4}" y="${y-4}" width="${tileW+8}" height="${tileW+8}" rx="13"
          fill="none" stroke="${AC}" stroke-width="3" stroke-opacity="0.5" filter="url(#blur)"/>`;
      }
      tiles += `<text x="${x + tileW/2}" y="${y + tileW/2 + 7}" text-anchor="middle"
        font-family="system-ui,sans-serif" font-size="${String(v).length > 3 ? 18 : 22}"
        font-weight="800" fill="${isKey ? '#fff' : '#8b95bf'}">${v}</text>`;
    });
  });
  // merge arrow between the two 1024s
  const ax = startX + 2*(tileW+gap) + tileW/2, ay = startY + 2*(tileW+gap) + tileW/2;
  const arrow = `
    <line x1="${ax - 30}" y1="${ay}" x2="${ax + 30}" y2="${ay}"
      stroke="${AC}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <polygon points="${ax+30},${ay} ${ax+20},${ay-7} ${ax+20},${ay+7}"
      fill="${AC}" opacity="0.7"/>`;
  // burst dots
  const bursts = [[450,230,3],[440,200,2],[465,255,2],[480,215,4],[435,245,2],[470,240,3]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    <defs><filter id="blur"><feGaussianBlur stdDeviation="6"/></filter></defs>
    ${tiles}
    ${arrow}
    ${particles(bursts, AC, 0.55)}
    ${particles([[60,120,3],[580,160,2],[70,380,2],[590,340,3],[100,280,2],[560,420,2],[80,200,2],[570,250,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'MERGE PUZZLE', AC)}
    ${title('Fuse', 'Merge tiles · Reach 2048', MU)}
  </svg>`;
}

function svgStack() {
  const BG = '#08160c', BG2 = '#0d2214', AC = '#4eff91', MU = '#61876f';
  // Tower blocks narrowing upward
  const blocks = [
    { w: 200, y: 360 },
    { w: 185, y: 315 },
    { w: 165, y: 270 },
    { w: 145, y: 228 },
    { w: 128, y: 188 },
    { w: 110, y: 150 },
  ];
  const cx = 315;
  let tower = '';
  blocks.forEach((b, i) => {
    const x = cx - b.w / 2;
    const opacity = 0.5 + i * 0.09;
    tower += `<rect x="${x}" y="${b.y}" width="${b.w}" height="38" rx="6"
      fill="${AC}" fill-opacity="${opacity}"/>`;
  });
  // Falling block (mid-air, slightly offset for drama)
  const fb = { w: 108, x: cx - 54 + 18, y: 98 };
  tower += `<rect x="${fb.x}" y="${fb.y}" width="${fb.w}" height="38" rx="6"
    fill="${AC}" fill-opacity="0.95" stroke="#fff" stroke-width="1.5" stroke-opacity="0.3"/>`;
  // Motion blur lines
  for (let i = 0; i < 5; i++) {
    const lx = fb.x + 20 + i * 14;
    tower += `<line x1="${lx}" y1="${fb.y + 38}" x2="${lx}" y2="${fb.y + 38 + 12 + i*4}"
      stroke="${AC}" stroke-width="1.5" stroke-opacity="${0.4 - i*0.07}" stroke-linecap="round"/>`;
  }
  // Alignment guides
  const topBlock = blocks[blocks.length - 1];
  const gx1 = cx - topBlock.w / 2, gx2 = cx + topBlock.w / 2;
  tower += `
    <line x1="${gx1}" y1="80" x2="${gx1}" y2="155" stroke="${AC}" stroke-width="1"
      stroke-opacity="0.35" stroke-dasharray="4 4"/>
    <line x1="${gx2}" y1="80" x2="${gx2}" y2="155" stroke="${AC}" stroke-width="1"
      stroke-opacity="0.35" stroke-dasharray="4 4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${tower}
    ${particles([[80,120,2],[560,100,3],[90,300,2],[570,280,2],[80,420,3],[600,380,2],[100,200,2],[540,200,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'ARCADE', AC)}
    ${title('Stack', 'Tap to drop · Build your tower', MU)}
  </svg>`;
}

function svgOrbit() {
  const BG = '#081a18', BG2 = '#0d2420', AC = '#4fe0c8', MU = '#6f8e96';
  // Jar outline
  const jx = 215, jy = 68, jw = 200, jh = 310;
  let scene = `
    <rect x="${jx}" y="${jy}" width="${jw}" height="${jh}" rx="22"
      fill="${BG2}" fill-opacity="0.7" stroke="${AC}" stroke-width="2.5" stroke-opacity="0.4"/>`;
  // Orbs stacked inside (ascending size)
  const orbs = [
    { r: 12, cx: 260, cy: 350, c: '#a0f0e0' },
    { r: 12, cx: 300, cy: 350, c: '#a0f0e0' },
    { r: 18, cx: 340, cy: 347, c: '#70d8c0' },
    { r: 22, cx: 250, cy: 320, c: '#50c8a8' },
    { r: 28, cx: 295, cy: 311, c: '#40b898' },
    { r: 35, cx: 345, cy: 303, c: '#30a888' },
    { r: 44, cx: 273, cy: 267, c: '#2898a8' },
    { r: 55, cx: 340, cy: 255, c: AC },
  ];
  orbs.forEach(o => {
    scene += `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${o.c}" opacity="0.88"/>`;
  });
  // Two equal large orbs touching with merge glow
  scene += `
    <circle cx="243" cy="174" r="42" fill="#1e8878" opacity="0.9"/>
    <circle cx="327" cy="174" r="42" fill="#1e8878" opacity="0.9"/>
    <circle cx="285" cy="174" r="10" fill="${AC}" opacity="0.9" filter="url(#gfx)"/>
    <circle cx="285" cy="174" r="22" fill="${AC}" opacity="0.25" filter="url(#gfx)"/>`;
  // Drop cursor line
  scene += `<line x1="315" y1="${jy}" x2="315" y2="128" stroke="${AC}"
    stroke-width="1.5" stroke-dasharray="5 5" stroke-opacity="0.4"/>
  <circle cx="315" cy="118" r="7" fill="${AC}" fill-opacity="0.6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    <defs><filter id="gfx"><feGaussianBlur stdDeviation="8"/></filter></defs>
    ${scene}
    ${particles([[80,100,2],[560,120,3],[70,380,2],[590,360,3],[80,260,2],[570,250,2],[100,440,2],[540,440,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'PHYSICS MERGE', AC)}
    ${title('Orbit', 'Drop and fuse cosmic orbs', MU)}
  </svg>`;
}

function svgGemDrop() {
  const BG = '#0e0820', BG2 = '#160d30', AC = '#c678f0', MU = '#8870b0';
  const colors = ['#e84393','#c678f0','#4fd6ff','#4eff91','#ffb347','#ff6b6b'];
  // 6×7 gem grid (diamond/rotated squares)
  const GW = 52, GH = 52, cols = 6, rows = 7;
  const gStartX = (W - cols * GW - (cols-1)*6) / 2 + 10;
  const gStartY = 58;
  // pre-defined highlight row indices (a 4-diagonal match on column 3)
  const highlighted = new Set(['1-2','2-3','3-4','4-5']);
  let gems = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = gStartX + c * (GW + 6) + GW/2;
      const cy = gStartY + r * (GH + 5) + GH/2;
      const col = colors[(r * 3 + c * 2) % colors.length];
      const key = `${r}-${c}`;
      const isHL = highlighted.has(key);
      const size = GW * 0.38;
      gems += `<rect x="${cx - size}" y="${cy - size}" width="${size*2}" height="${size*2}"
        rx="5" transform="rotate(45 ${cx} ${cy})"
        fill="${col}" fill-opacity="${isHL ? 1 : 0.55}"
        ${isHL ? `stroke="#fff" stroke-width="2.5" stroke-opacity="0.8"` : ''}/>`;
      if (isHL) {
        gems += `<rect x="${cx - size - 5}" y="${cy - size - 5}" width="${size*2+10}" height="${size*2+10}"
          rx="8" transform="rotate(45 ${cx} ${cy})"
          fill="none" stroke="#fff" stroke-width="3" stroke-opacity="0.25"/>`;
      }
    }
  }
  // Cascade arrow
  gems += `<text x="${W/2}" y="${H-95}" text-anchor="middle"
    font-family="system-ui,sans-serif" font-size="28" fill="${AC}" opacity="0.5">↓ ↓ ↓</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${gems}
    ${particles([[55,100,2],[575,120,2],[60,420,2],[570,400,2],[50,280,3],[580,300,2]], AC, 0.2)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'MATCH-3', AC)}
    ${title('Gem Drop', 'Swap · Match · Cascade', MU)}
  </svg>`;
}

function svgBurst() {
  const BG = '#08181f', BG2 = '#0d2430', AC = '#38d4f5', MU = '#5a8fa8';
  const bubbleColors = ['#38d4f5','#c678f0','#4eff91','#ffb347','#ff6b6b','#5b8cff'];
  // Hex grid of bubbles
  const R = 28, cols = 7, rows = 5;
  const hStartX = 315 - (cols * (R*2+4)) / 2 + R;
  const hStartY = 82;
  let bubbles = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = hStartX + col * (R*2 + 4) + (row % 2) * (R + 2);
      const cy = hStartY + row * (R * 1.72);
      const col2 = bubbleColors[(row * 3 + col * 2) % bubbleColors.length];
      // Highlight a cluster of 3 cyan bubbles at row 1, cols 2-4
      const isTarget = row === 1 && col >= 2 && col <= 4 && col2 === AC;
      const isPopping = row === 1 && (col === 2 || col === 3) && col2 === AC;
      bubbles += `<circle cx="${cx}" cy="${cy}" r="${R}"
        fill="${bubbleColors[(row*4+col*3)%bubbleColors.length]}"
        fill-opacity="${isPopping ? 0.3 : 0.72}"
        stroke="${isTarget ? '#fff' : 'transparent'}" stroke-width="2" stroke-opacity="0.5"/>`;
      // Inner highlight
      bubbles += `<circle cx="${cx - R*0.28}" cy="${cy - R*0.28}" r="${R*0.25}"
        fill="#fff" opacity="0.18"/>`;
    }
  }
  // Flying bubble from bottom
  bubbles += `
    <circle cx="315" cy="400" r="${R}" fill="${AC}" opacity="0.92"/>
    <circle cx="${315 - R*0.28}" cy="${400 - R*0.28}" r="${R*0.25}" fill="#fff" opacity="0.22"/>
    <line x1="315" y1="360" x2="315" y2="238" stroke="${AC}"
      stroke-width="2" stroke-dasharray="6 5" stroke-opacity="0.45"/>`;
  // Pop particles around target
  const pops = [[285,165,4],[270,175,3],[300,160,3],[310,178,4],[275,158,3]];
  pops.forEach(([x,y,r2]) => {
    bubbles += `<circle cx="${x}" cy="${y}" r="${r2}" fill="${AC}" opacity="0.7"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${bubbles}
    ${particles([[55,380,2],[580,100,2],[60,200,2],[575,300,2]], AC, 0.15)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'BUBBLE SHOOTER', AC)}
    ${title('Burst', 'Aim · Fire · Pop', MU)}
  </svg>`;
}

function svgIdle() {
  const BG = '#1a1008', BG2 = '#261808', AC = '#ffb347', MU = '#b09572';
  // Large ore circle
  let scene = `
    <defs>
      <radialGradient id="ore" cx="38%" cy="32%" r="55%">
        <stop offset="0%" stop-color="#ffe9bb"/>
        <stop offset="55%" stop-color="${AC}"/>
        <stop offset="100%" stop-color="#c97a12"/>
      </radialGradient>
      <filter id="oreGlow"><feGaussianBlur stdDeviation="14"/></filter>
    </defs>
    <circle cx="270" cy="230" r="108" fill="${AC}" opacity="0.18" filter="url(#oreGlow)"/>
    <circle cx="270" cy="230" r="88" fill="url(#ore)"/>`;
  // Coin shower (exploding outward)
  const coins = [
    [210,108,18],[340,95,14],[170,155,12],[380,140,16],[160,240,10],[390,230,14],
    [185,330,12],[360,320,16],[230,375,14],[315,368,12],
    [430,185,10],[440,270,12],[110,200,10],[120,295,12],
  ];
  coins.forEach(([cx, cy, r]) => {
    scene += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd76a" opacity="0.75"/>
      <circle cx="${cx}" cy="${cy}" r="${r*0.55}" fill="#ffe9bb" opacity="0.45"/>`;
  });
  // Tap hand icon suggestion (simple circle tap)
  scene += `<circle cx="270" cy="230" r="30" fill="none" stroke="#fff"
    stroke-width="2.5" stroke-opacity="0.25"/>`;
  // Shop panel ghost (right side)
  const items = ['Extra Hand','Drill Rig','Ore Cart','Excavator'];
  scene += `<rect x="440" y="90" width="155" height="${items.length * 50 + 20}" rx="12"
    fill="${BG2}" fill-opacity="0.65" stroke="${AC}" stroke-width="1" stroke-opacity="0.2"/>`;
  items.forEach((name, i) => {
    scene += `
      <rect x="454" y="${108 + i*50}" width="127" height="34" rx="8"
        fill="${AC}" fill-opacity="0.08"/>
      <text x="464" y="${130 + i*50}" font-family="system-ui,sans-serif"
        font-size="12" fill="#fff" opacity="0.6">${name}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${scene}
    ${particles([[70,430,2],[80,80,2],[560,420,2],[570,80,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'IDLE CLICKER', AC)}
    ${title('Coin Forge', 'Tap · Hire · Watch numbers grow', MU)}
  </svg>`;
}

function svgSplat() {
  const BG = '#081a14', BG2 = '#0d261c', AC = '#3ee6b8', MU = '#5f8499';
  // Arena circle
  let scene = `
    <circle cx="${W/2}" cy="${H/2 - 20}" r="195" fill="none"
      stroke="${AC}" stroke-width="1.5" stroke-opacity="0.12" stroke-dasharray="8 6"/>`;
  // Pellet dots scattered
  const pellets = [
    [160,140],[480,160],[120,280],[520,260],[140,380],[490,380],
    [220,120],[400,100],[200,400],[420,400],[300,110],[300,390],
    [110,200],[540,200],[110,350],[540,340],
  ];
  pellets.forEach(([x,y]) => {
    scene += `<circle cx="${x}" cy="${y}" r="5" fill="${AC}" opacity="0.3"/>`;
  });
  // Small enemy blobs
  const blobColors = ['#ff6b6b','#c678f0','#ffb347','#5b8cff','#4eff91'];
  const smBlobs = [[160,160,22],[490,170,18],[140,350,26],[510,340,20],[380,120,15]];
  smBlobs.forEach(([x,y,r],i) => {
    scene += `<circle cx="${x}" cy="${y}" r="${r}" fill="${blobColors[i%blobColors.length]}" opacity="0.75"/>`;
  });
  // Large player blob (centre, dominant)
  scene += `
    <circle cx="${W/2}" cy="${H/2 - 20}" r="82" fill="${AC}" opacity="0.85"/>
    <circle cx="${W/2 - 24}" cy="${H/2 - 44}" r="20" fill="#fff" opacity="0.14"/>
    <text x="${W/2}" y="${H/2 - 10}" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="14" font-weight="700"
      fill="#051008" opacity="0.6">#1</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${scene}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'IO ARENA', AC)}
    ${title('Splat', 'Eat smaller · Dodge bigger', MU)}
  </svg>`;
}

function svgRunner() {
  const BG = '#08161f', BG2 = '#0d2030', AC = '#4fd6ff', MU = '#6f8aa8';
  const laneW = 110, laneGap = 18;
  const lx = (W - 3*laneW - 2*laneGap) / 2;
  // Lane tracks (perspective effect: wider at bottom, narrower at top)
  let scene = '';
  for (let i = 0; i < 3; i++) {
    const x = lx + i * (laneW + laneGap);
    scene += `<rect x="${x}" y="62" width="${laneW}" height="${H - 135}" rx="10"
      fill="${BG2}" fill-opacity="0.6" stroke="${AC}" stroke-width="1" stroke-opacity="0.15"/>`;
    // Lane divider dashes
    for (let d = 0; d < 7; d++) {
      scene += `<rect x="${x + laneW/2 - 1}" y="${75 + d*40}" width="2" height="20"
        fill="${AC}" opacity="0.12" rx="1"/>`;
    }
  }
  // Obstacle in left lane (red)
  const obsX = lx + 14, obsY = 180;
  scene += `<rect x="${obsX}" y="${obsY}" width="${laneW - 28}" height="52" rx="8"
    fill="#ff4a4a" opacity="0.88"/>
    <text x="${obsX + (laneW-28)/2}" y="${obsY + 32}" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="22" fill="#fff" opacity="0.7">✕</text>`;
  // Player blob in centre lane
  const plX = lx + laneW + laneGap + laneW/2;
  scene += `<rect x="${plX - 28}" y="260" width="56" height="52" rx="10"
    fill="${AC}" opacity="0.92"/>`;
  // Motion blur behind player
  for (let m = 0; m < 5; m++) {
    scene += `<rect x="${plX - 24}" y="${265 + m*8}" width="48" height="4" rx="2"
      fill="${AC}" opacity="${0.25 - m*0.04}"/>`;
  }
  // Speed lines across all lanes
  for (let s = 0; s < 8; s++) {
    const sx = lx + 10 + s * 73;
    scene += `<line x1="${sx}" y1="68" x2="${sx - 8}" y2="355"
      stroke="${AC}" stroke-width="1" stroke-opacity="0.06" stroke-linecap="round"/>`;
  }
  // Near-miss star
  scene += `<text x="${lx + laneW + laneGap + laneW + 22}" y="215"
    font-family="system-ui,sans-serif" font-size="20" fill="${AC}" opacity="0.55">+15</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${scene}
    ${particles([[60,100,2],[570,120,2],[55,350,2],[575,340,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'ENDLESS RUNNER', AC)}
    ${title('Dash Lanes', 'Switch lanes · Dodge · Survive', MU)}
  </svg>`;
}

function svgEquate() {
  const BG = '#081a18', BG2 = '#0d2420', AC = '#4fe0c8', MU = '#6f8e96';
  const COLS = 8, ROWS = 6;
  const TW = 52, TH = 50, gap = 6;
  const gW = COLS * TW + (COLS-1) * gap;
  const startX = (W - gW) / 2;
  const startY = 52;
  // Mock equation rows — top 3 guessed, bottom 3 empty
  const rows = [
    // row 0: correct (all green) — "12+34=46"
    ['correct','correct','correct','correct','correct','correct','correct','correct'],
    // row 1: mixed — "56+23=79" with some yellows
    ['correct','absent','present','correct','correct','absent','correct','correct'],
    // row 2: partial — first attempt
    ['absent','present','correct','absent','correct','correct','absent','present'],
    null, null, null,
  ];
  const chars = [
    ['1','2','+','3','4','=','4','6'],
    ['5','6','+','2','3','=','7','9'],
    ['9','1','*','2','=','1','8','2'],
  ];
  const tileCol = s => s === 'correct' ? '#2faa7a' : s === 'present' ? '#c98c2c' : s === 'absent' ? '#1a2a28' : BG2;
  let grid = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = startX + c * (TW + gap);
      const y = startY + r * (TH + gap);
      const state = rows[r] ? rows[r][c] : null;
      const col = tileCol(state);
      grid += `<rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="7"
        fill="${col}" stroke="${state ? 'transparent' : AC}" stroke-width="1.5"
        stroke-opacity="0.18"/>`;
      if (rows[r] && chars[r]) {
        grid += `<text x="${x + TW/2}" y="${y + TH/2 + 8}" text-anchor="middle"
          font-family="'SF Mono',Consolas,monospace" font-size="22" font-weight="800"
          fill="#fff" opacity="${state === 'absent' ? 0.4 : 0.95}">${chars[r][c]}</text>`;
      }
    }
  }
  // DAILY badge
  grid += `<rect x="${startX + gW + 14}" y="${startY}" width="72" height="28" rx="14"
    fill="${AC}" fill-opacity="0.2" stroke="${AC}" stroke-width="1.5" stroke-opacity="0.6"/>
  <text x="${startX + gW + 50}" y="${startY + 19}" text-anchor="middle"
    font-family="system-ui,sans-serif" font-size="12" font-weight="800"
    letter-spacing="1.5" fill="${AC}">DAILY</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${grid}
    ${particles([[55,430,2],[570,430,2],[50,160,2],[575,180,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'DAILY PUZZLE', AC)}
    ${title('Equate', 'Guess the equation · 6 tries', MU)}
  </svg>`;
}

function svgOutpost() {
  const BG = '#091a0d', BG2 = '#0d2614', AC = '#5ef79b', MU = '#61876f';
  // Serpentine path
  const pathD = `M 80 90 L 80 200 L 240 200 L 240 120 L 400 120 L 400 260
    L 260 260 L 260 370 L 460 370 L 460 280 L 560 280`;
  let scene = `
    <path d="${pathD}" fill="none" stroke="${BG2}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${pathD}" fill="none" stroke="${AC}" stroke-width="2" stroke-opacity="0.3"
      stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 6"/>`;
  // Turret hexagons (alongside the path)
  const turrets = [[155,136],[318,82],[155,300],[388,310]];
  turrets.forEach(([tx, ty]) => {
    const pts = [];
    for (let a = 0; a < 6; a++) {
      const ang = (a * 60 - 30) * Math.PI / 180;
      pts.push(`${tx + 20*Math.cos(ang)},${ty + 20*Math.sin(ang)}`);
    }
    scene += `
      <polygon points="${pts.join(' ')}" fill="${AC}" fill-opacity="0.75" stroke="#fff" stroke-width="1.5" stroke-opacity="0.2"/>
      <circle cx="${tx}" cy="${ty}" r="7" fill="#fff" opacity="0.3"/>`;
  });
  // Enemy squares marching the path
  const enemies = [[115,185],[170,200],[225,165],[318,140],[360,140],[415,230]];
  enemies.forEach(([ex,ey]) => {
    scene += `<rect x="${ex-10}" y="${ey-10}" width="20" height="20" rx="4"
      fill="#ff4a4a" opacity="0.78"/>`;
  });
  // Beam firing from turret at [155,300] toward nearest enemy
  scene += `<line x1="155" y1="300" x2="225" y2="165"
    stroke="${AC}" stroke-width="3" stroke-opacity="0.7" stroke-linecap="round"/>
  <circle cx="225" cy="165" r="5" fill="${AC}" opacity="0.9"/>`;
  // Impact burst
  for (let i = 0; i < 4; i++) {
    const ang2 = i * 90 * Math.PI/180;
    scene += `<line x1="225" y1="165"
      x2="${225 + Math.cos(ang2)*18}" y2="${165 + Math.sin(ang2)*18}"
      stroke="${AC}" stroke-width="2" stroke-opacity="0.55" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${bg(BG, BG2, AC)}
    ${scene}
    ${particles([[590,90,2],[590,420,2],[40,420,2]], AC, 0.18)}
    ${wordmark(AC)}
    ${chip(W - 22, 14, 'TOWER DEFENSE', AC)}
    ${title('Outpost', 'Build · Upgrade · Survive the waves', MU)}
  </svg>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const games = [
  ['fuse',   svgFuse],
  ['stack',  svgStack],
  ['orbit',  svgOrbit],
  ['match3', svgGemDrop],
  ['bubble', svgBurst],
  ['idle',   svgIdle],
  ['io',     svgSplat],
  ['runner', svgRunner],
  ['equate', svgEquate],
  ['td',     svgOutpost],
];

async function main() {
  for (const [slug, fn] of games) {
    const svg = fn();
    const outPath = join(OUT, `cover-${slug}.png`);
    await sharp(Buffer.from(svg))
      .resize(W, H)
      .png({ compressionLevel: 8 })
      .toFile(outPath);
    console.log(`✓  cover-${slug}.png`);
  }
  console.log(`\nAll 10 covers → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
