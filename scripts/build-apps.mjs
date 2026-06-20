#!/usr/bin/env node
/**
 * build-apps.mjs — generate 10 individual Capacitor app projects under apps/<slug>/
 *
 * Each app gets:
 *   apps/<slug>/
 *     capacitor.config.json   (unique appId + appName)
 *     package.json            (symlinks to root node_modules via workspace trick)
 *     www/
 *       index.html            (adapted path references)
 *       game.js               (copied from games/<slug>/)
 *       style.css             (copied from games/<slug>/)
 *       meta.json             (copied from games/<slug>/)
 *       shared/
 *         juice.js
 *         retention.js
 *
 * Usage:
 *   node scripts/build-apps.mjs              # set up web assets only
 *   node scripts/build-apps.mjs --native     # also run npx cap add android ios (slow, ~10 min)
 *   node scripts/build-apps.mjs --slug fuse  # only one game
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname }                                                  from 'node:path';
import { fileURLToPath }                                                     from 'node:url';
import { execSync }                                                          from 'node:child_process';

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPS   = resolve(ROOT, 'apps');

const GAMES = [
  { slug: 'fuse',    id: 'com.prismplay.fuse',       name: 'Fuse' },
  { slug: 'stack',   id: 'com.prismplay.stack',      name: 'Stack' },
  { slug: 'orbit',   id: 'com.prismplay.orbit',      name: 'Orbit' },
  { slug: 'match3',  id: 'com.prismplay.gemdrop',    name: 'Gem Drop' },
  { slug: 'bubble',  id: 'com.prismplay.burst',      name: 'Burst' },
  { slug: 'idle',    id: 'com.prismplay.coinforge',   name: 'Coin Forge' },
  { slug: 'io',      id: 'com.prismplay.splat',      name: 'Splat' },
  { slug: 'runner',  id: 'com.prismplay.dashlanes',  name: 'Dash Lanes' },
  { slug: 'equate',  id: 'com.prismplay.equate',     name: 'Equate' },
  { slug: 'td',      id: 'com.prismplay.outpost',    name: 'Outpost' },
  { slug: 'kickle',  id: 'com.prismplay.kickle',     name: 'Kickle' },
];

const addNative = process.argv.includes('--native');
const onlySlug  = (() => {
  const i = process.argv.indexOf('--slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const targets = onlySlug ? GAMES.filter(g => g.slug === onlySlug) : GAMES;
if (!targets.length) { console.error('No matching game for slug:', onlySlug); process.exit(1); }

mkdirSync(APPS, { recursive: true });

for (const { slug, id, name } of targets) {
  console.log(`\n▶  ${name} (${id})`);

  const appDir = resolve(APPS, slug);
  const wwwDir = resolve(appDir, 'www');
  const sharedDir = resolve(wwwDir, 'shared');
  const srcDir = resolve(ROOT, 'games', slug);

  mkdirSync(wwwDir,    { recursive: true });
  mkdirSync(sharedDir, { recursive: true });

  // ---- Copy game files ----
  for (const f of ['game.js', 'style.css', 'meta.json']) {
    const src = resolve(srcDir, f);
    if (existsSync(src)) {
      copyFileSync(src, resolve(wwwDir, f));
      console.log(`  ✓ copied ${f}`);
    }
  }

  // ---- Adapt index.html (rewrite ../../shared/ → shared/) ----
  const srcHtml = resolve(srcDir, 'index.html');
  if (existsSync(srcHtml)) {
    let html = readFileSync(srcHtml, 'utf8');
    // Fix shared/ references
    html = html.replace(/\.\.\/\.\.\/shared\//g, 'shared/');
    // Fix href="/" back link (keep it absolute — WebView opens the OS browser for external links)
    // Replace with a close-app friendly text for native context
    html = html.replace(
      /href="\/"\s+style="[^"]*"[^>]*>(&larr;|←) All 10 Prism Play games<\/a>/g,
      'href="/" style="color:var(--accent);text-decoration:none">← All Prism Play games</a>'
    );
    writeFileSync(resolve(wwwDir, 'index.html'), html, 'utf8');
    console.log('  ✓ index.html adapted');
  }

  // ---- Copy shared libraries ----
  for (const f of ['juice.js', 'retention.js']) {
    copyFileSync(resolve(ROOT, 'shared', f), resolve(sharedDir, f));
  }
  console.log('  ✓ shared/juice.js + retention.js');

  // ---- Write capacitor.config.json ----
  const cap = {
    appId:   id,
    appName: name,
    webDir:  'www',
    bundledWebRuntime: false,
    plugins: {
      SplashScreen: {
        launchShowDuration: 1200,
        backgroundColor:    '#080d1e',
        androidSplashResourceName: 'splash',
        showSpinner: false,
        launchAutoHide: true,
      },
      StatusBar: {
        style:           'Dark',
        backgroundColor: '#080d1e',
      },
    },
  };
  writeFileSync(resolve(appDir, 'capacitor.config.json'), JSON.stringify(cap, null, 2), 'utf8');
  console.log('  ✓ capacitor.config.json');

  // ---- Write package.json (inherits node_modules from root via ..) ----
  const pkg = {
    name:    id,
    version: '1.0.0',
    private: true,
    dependencies: {
      '@capacitor/core':         '^8.4.0',
      '@capacitor/android':     '^8.4.0',
      '@capacitor/ios':         '^8.4.0',
      '@capacitor/cli':         '^8.4.0',
      '@capacitor/splash-screen': '^8.0.1',
    },
  };
  writeFileSync(resolve(appDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  console.log('  ✓ package.json');

  // ---- Symlink root node_modules so we don't re-install 10× ----
  const nmLink = resolve(appDir, 'node_modules');
  const nmRoot = resolve(ROOT, 'node_modules');
  if (!existsSync(nmLink) && existsSync(nmRoot)) {
    try {
      execSync(`ln -s "${nmRoot}" "${nmLink}"`, { stdio: 'pipe' });
      console.log('  ✓ node_modules → root symlink');
    } catch {
      console.log('  ⚠ node_modules symlink skipped (already exists or failed)');
    }
  }

  // ---- Optionally add native platforms ----
  if (addNative) {
    console.log('  ⟳  npx cap add android (this takes ~2 min)…');
    try {
      execSync('npx cap add android', { cwd: appDir, stdio: 'inherit' });
      console.log('  ✓ android added');
    } catch { console.error('  ✗ android failed — check Android Studio is installed'); }

    console.log('  ⟳  npx cap add ios (this takes ~2 min)…');
    try {
      execSync('npx cap add ios', { cwd: appDir, stdio: 'inherit' });
      console.log('  ✓ ios added');
    } catch { console.error('  ✗ ios failed — check Xcode is installed'); }
  }

  console.log(`  ✅ ${name} → apps/${slug}/`);
}

console.log('\n══════════════════════════════════════════════');
console.log('Web assets ready for all', targets.length, 'apps.');
console.log('\nNext steps per app:');
console.log('  cd apps/<slug>');
console.log('  npx cap add android   # adds android/ native project');
console.log('  npx cap add ios       # adds ios/ native project');
console.log('  npx cap open android  # opens Android Studio');
console.log('  npx cap open ios      # opens Xcode');
console.log('\nOr run everything at once:');
console.log('  node scripts/build-apps.mjs --native');
console.log('══════════════════════════════════════════════\n');
