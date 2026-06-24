/* shared/stage.js — shared level / objective UI, reused by every game.
 * Global: window.Stage. No build step; include with a plain <script> tag.
 *
 * Gives each game the "campaign" presentation that bare clones lack — a level
 * intro card, an objective banner, a level-complete star screen, reward toasts,
 * and a daily-mission list — without each game rebuilding modal UI. Renders as
 * DOM over the play area and inherits each game's palette via its CSS custom
 * properties (--accent, --panel, --text, --muted, --bg), so it matches per-game
 * theming automatically. Animations respect prefers-reduced-motion.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var layer = null, styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css =
      '.stage-layer{position:fixed;inset:0;z-index:40;pointer-events:none;' +
        'display:flex;align-items:center;justify-content:center;font-family:inherit}' +
      '.stage-card{pointer-events:auto;background:var(--panel,#19203c);color:var(--text,#eef2ff);' +
        'border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:24px 22px;width:min(86%,340px);' +
        'text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.7);animation:stagePop .3s cubic-bezier(.2,1.3,.5,1) both}' +
      '.stage-card h2{margin:0 0 4px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted,#8b95bf)}' +
      '.stage-card h1{margin:0 0 12px;font-size:30px;font-weight:900}' +
      '.stage-card p{margin:0 0 16px;color:var(--muted,#8b95bf);line-height:1.5}' +
      '.stage-stars{font-size:40px;letter-spacing:6px;margin:6px 0 14px;line-height:1}' +
      '.stage-star-on{color:var(--accent,#5b8cff)}.stage-star-off{color:rgba(255,255,255,.16)}' +
      '.stage-btn{font-family:inherit;cursor:pointer;border:none;border-radius:12px;width:100%;' +
        'padding:14px 18px;font-weight:800;font-size:16px;margin-top:8px;' +
        'background:linear-gradient(135deg,var(--accent,#5b8cff),var(--accent2,#7af0d0));color:#07101f;' +
        'transition:transform .08s ease,filter .12s ease}' +
      '.stage-btn.ghost{background:transparent;border:1.5px solid color-mix(in srgb,var(--accent,#5b8cff) 55%,transparent);color:var(--text,#eef2ff)}' +
      '.stage-btn:active{transform:scale(.96)}.stage-btn:hover{filter:brightness(1.1)}' +
      '.stage-banner{position:absolute;top:0;left:50%;transform:translateX(-50%);' +
        'background:var(--panel,#19203c);border:1px solid rgba(255,255,255,.10);border-radius:0 0 14px 14px;' +
        'padding:7px 16px;font-size:13px;font-weight:700;color:var(--text,#eef2ff);pointer-events:none;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.4);max-width:90%}' +
      '.stage-banner b{color:var(--accent,#5b8cff)}' +
      '.stage-toast{position:absolute;top:14%;left:50%;transform:translateX(-50%) translateY(-6px);' +
        'background:var(--accent,#5b8cff);color:#07101f;font-weight:800;font-size:14px;padding:9px 16px;' +
        'border-radius:999px;pointer-events:none;box-shadow:0 8px 22px rgba(0,0,0,.45);opacity:0;' +
        'transition:opacity .25s ease,transform .25s ease}' +
      '.stage-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.stage-missions{text-align:left;margin:0 0 14px;padding:0;list-style:none}' +
      '.stage-missions li{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;margin:6px 0;' +
        'background:rgba(255,255,255,.05);border-radius:10px;font-size:13px}' +
      '.stage-missions .done{color:var(--accent,#5b8cff)}' +
      '.stage-missions .mr{color:var(--muted,#8b95bf);white-space:nowrap}' +
      '@keyframes stagePop{from{transform:translateY(14px) scale(.92);opacity:0}}' +
      '@media (prefers-reduced-motion:reduce){.stage-card{animation:none}}';
    var el = doc.createElement('style');
    el.textContent = css;
    doc.head.appendChild(el);
  }

  function ensureLayer() {
    injectStyle();
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'stage-layer';
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function clearCards() {
    if (!layer) return;
    var cards = layer.querySelectorAll('.stage-card');
    for (var i = 0; i < cards.length; i++) cards[i].remove();
  }

  function starsHTML(n) {
    n = Math.max(0, Math.min(3, n | 0));
    var s = '';
    for (var i = 0; i < 3; i++) s += '<span class="' + (i < n ? 'stage-star-on' : 'stage-star-off') + '">★</span>';
    return '<div class="stage-stars">' + s + '</div>';
  }

  var Stage = {
    starsHTML: starsHTML,

    // Generic modal card. actions: [{label, ghost?, onClick}]. Auto-closes on click.
    card: function (opts) {
      var l = ensureLayer();
      clearCards();
      var card = doc.createElement('div');
      card.className = 'stage-card';
      var html = '';
      if (opts.kicker) html += '<h2>' + opts.kicker + '</h2>';
      if (opts.title) html += '<h1>' + opts.title + '</h1>';
      if (opts.stars != null) html += starsHTML(opts.stars);
      if (opts.body) html += '<p>' + opts.body + '</p>';
      card.innerHTML = html;
      (opts.actions || []).forEach(function (a) {
        var b = doc.createElement('button');
        b.className = 'stage-btn' + (a.ghost ? ' ghost' : '');
        b.textContent = a.label;
        b.addEventListener('click', function () {
          if (!a.keepOpen) Stage.close();
          if (a.onClick) a.onClick();
        });
        card.appendChild(b);
      });
      l.appendChild(card);
      return card;
    },

    // Level intro: "LEVEL n / objective / [Start]"
    levelIntro: function (level, objectiveText, onStart) {
      return this.card({
        kicker: 'Level ' + level,
        title: 'Ready?',
        body: objectiveText,
        actions: [{ label: 'Start', onClick: onStart }]
      });
    },

    // Level complete star screen.
    levelComplete: function (opts) {
      var actions = [];
      if (opts.onNext) actions.push({ label: opts.nextLabel || 'Next level', onClick: opts.onNext });
      if (opts.onRetry) actions.push({ label: 'Replay', ghost: true, onClick: opts.onRetry });
      return this.card({
        kicker: opts.kicker || ('Level ' + opts.level),
        title: opts.title || (opts.stars > 0 ? 'Complete!' : 'So close!'),
        stars: opts.stars,
        body: opts.body || '',
        actions: actions
      });
    },

    close: function () { clearCards(); },

    // Persistent objective banner over the board. Returns a handle.
    banner: function (parent, text) {
      injectStyle();
      var host = parent || doc.body;
      var el = doc.createElement('div');
      el.className = 'stage-banner';
      el.innerHTML = text;
      host.appendChild(el);
      return {
        set: function (t) { el.innerHTML = t; },
        remove: function () { if (el.parentNode) el.parentNode.removeChild(el); }
      };
    },

    // Transient toast (e.g., "Mission complete +25").
    toast: function (parent, text, ms) {
      injectStyle();
      var host = parent || ensureLayer();
      var el = doc.createElement('div');
      el.className = 'stage-toast';
      el.innerHTML = text;
      host.appendChild(el);
      // force reflow then show
      void el.offsetWidth;
      el.classList.add('show');
      setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
      }, ms || 1400);
    },

    // Build a daily-mission <ul> for embedding in a card body.
    missionsHTML: function (missions) {
      var li = (missions || []).map(function (m) {
        var label = m.done ? '<span class="done">✓ ' + m.text + '</span>' : m.text;
        var right = m.done ? '+' + m.reward : (m.prog + '/' + m.target);
        return '<li>' + label + '<span class="mr">' + right + '</span></li>';
      }).join('');
      return '<ul class="stage-missions">' + li + '</ul>';
    }
  };

  global.Stage = Stage;
})(window);
