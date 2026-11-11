(function (C) {
  'use strict';
  // Shared effects: particles, shake, ring, marks, speech bubble, thinking dots.
  // Pure helpers (particlesFor / budget / specs / glyph) are testable in Node; the rest touches the DOM.
  // Reduced motion: no shake, particles are 1/4 and shown static (css/effects.css), bubbles/marks just appear.

  var MAX_PARTICLES = 40;                       // total .fx-p on one layer
  var WISH = { confetti: 40, sparkle: 12 };
  var GLYPH = { sweat: '💦', bang: '❗', sparkle: '✨', zzz: '💤', steam: '💢', shield: '🛡️', smirk: '😏', note: '🎵', heart: '💖' };
  var PARTICLE_MS = 1700;
  var RING_MS = 900;
  var SHAKE_MS = 500;
  var BUBBLE_FADE_MS = 250;
  var CONFETTI_COLORS = 5;                      // classes c0..c4 in effects.css

  function isReduced() {
    return typeof window !== 'undefined' && !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function particlesFor(kind, reduced) {
    var n = WISH[kind] || 0;
    return Math.min(MAX_PARTICLES, reduced ? Math.ceil(n / 4) : n);
  }

  // How many more particles may be added when `existing` are already on the layer.
  function budget(wish, existing) {
    return Math.max(0, Math.min(wish, MAX_PARTICLES - existing));
  }

  function glyph(kind) {
    return Object.prototype.hasOwnProperty.call(GLYPH, kind) ? GLYPH[kind] : '';
  }

  // Deterministic particle layout (no Math.random, so tests and replays are stable).
  // confetti: fall from the top across w; sparkle: fly outward from the middle of the box.
  function specs(kind, n, w, h) {
    var out = [];
    for (var i = 0; i < n; i++) {
      if (kind === 'sparkle') {
        var ang = (i / Math.max(1, n)) * Math.PI * 2;
        var rad = 40 + (i % 3) * 22;
        out.push({ x: w / 2, y: h / 2, dx: Math.cos(ang) * rad, dy: Math.sin(ang) * rad, delay: (i % 4) * 60, color: i % 2 });
      } else {
        var x = ((i * 37 + 11) % 100) / 100 * w;
        out.push({ x: x, y: -20, dx: (((i * 29) % 21) - 10) * 6, dy: h * (0.55 + (i % 5) * 0.1), delay: (i % 8) * 110, color: i % CONFETTI_COLORS });
      }
    }
    return out;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function getLayer() {
    var layer = document.getElementById('fx-layer');
    if (!layer) {
      layer = el('div');
      layer.id = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  // kind: 'confetti' | 'sparkle'. `layer` is the element that holds the particles (its box sizes the burst).
  // origin (optional, sparkle only): { x, y } in layer pixels.
  function burst(layer, kind, origin) {
    var reduced = isReduced();
    var n = budget(particlesFor(kind, reduced), layer.querySelectorAll('.fx-p').length);
    var w = layer.clientWidth || window.innerWidth;
    var h = layer.clientHeight || window.innerHeight;
    var list = specs(kind, n, w, h);
    var made = [];
    list.forEach(function (s) {
      var p = el('div', 'fx-p fx-' + kind + (kind === 'confetti' ? ' c' + s.color : s.color ? ' alt' : '') + (reduced ? ' fx-static' : ''));
      var ox = origin ? origin.x - w / 2 : 0, oy = origin ? origin.y - h / 2 : 0;
      p.style.setProperty('--x', (s.x + ox) + 'px');
      p.style.setProperty('--y', (s.y + oy) + 'px');
      p.style.setProperty('--dx', s.dx + 'px');
      p.style.setProperty('--dy', s.dy + 'px');
      p.style.setProperty('--d', s.delay + 'ms');
      layer.appendChild(p);
      made.push(p);
    });
    setTimeout(function () {
      made.forEach(function (p) { if (p.parentNode) { p.parentNode.removeChild(p); } });
    }, PARTICLE_MS + 700);
    return made.length;
  }

  // Short vertical shake of one element. Nothing happens in reduced motion.
  function shake(target) {
    if (!target || isReduced()) { return false; }
    target.classList.remove('fx-shake');
    void target.offsetWidth;
    target.classList.add('fx-shake');
    setTimeout(function () { target.classList.remove('fx-shake'); }, SHAKE_MS);
    return true;
  }

  // An expanding ring around `target` (adds a child; target must be positioned).
  // opts.keep: the ring pulses until the caller removes it (no automatic removal).
  function ring(target, opts) {
    if (!target) { return null; }
    var keep = !!(opts && opts.keep);
    var r = el('span', 'fx-ring' + (isReduced() ? ' fx-static' : '') + (keep ? ' fx-keep' : ''));
    r.setAttribute('aria-hidden', 'true');
    target.appendChild(r);
    if (!keep) { setTimeout(function () { if (r.parentNode) { r.parentNode.removeChild(r); } }, RING_MS * 2); }
    return r;
  }

  // Sets the emotion mark glyph in `target` (kind null clears it).
  function mark(target, kind) {
    if (!target) { return; }
    target.textContent = glyph(kind);
    target.className = target.className.replace(/\s*fx-mark(-\w+)?/g, '') + (kind && glyph(kind) ? ' fx-mark fx-mark-' + kind : '');
  }

  // ---------------------------------------------------------------- speech bubble and thinking dots

  function stateOf(slot) {
    if (!slot._fx) { slot._fx = { node: null, kind: null, timer: null, text: null, think: false }; }
    return slot._fx;
  }

  function removeNode(st) {
    var node = st.node;
    st.node = null;
    if (!node) { return; }
    node.classList.add('fx-out');
    setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, BUBBLE_FADE_MS);
  }

  // Shows the line if there is one, otherwise the thinking dots if thinking, otherwise nothing.
  function refresh(slot) {
    var st = stateOf(slot);
    var want = st.text ? 'text' : (st.think ? 'dots' : null);
    if (want === st.kind && st.node) { return; }
    removeNode(st);
    st.kind = want;
    if (!want) { return; }
    var b = el('div', 'fx-bubble ' + (want === 'dots' ? 'fx-bubble-think' : 'fx-bubble-line'));
    if (want === 'text') {
      b.appendChild(el('span', 'fx-bubble-text', st.text));
    } else {
      var d = el('span', 'fx-dots');
      d.appendChild(el('span')); d.appendChild(el('span')); d.appendChild(el('span'));
      b.appendChild(d);
    }
    slot.appendChild(b);
    st.node = b;
  }

  function bubble(slot, text, ms) {
    if (!slot || !text) { return; }
    var st = stateOf(slot);
    clearTimeout(st.timer);
    st.text = text;
    st.kind = null;
    refresh(slot);
    st.timer = setTimeout(function () { st.text = null; refresh(slot); }, ms || 2500);
  }

  function thinking(slot, on) {
    if (!slot) { return; }
    stateOf(slot).think = !!on;
    refresh(slot);
  }

  C.Effects = {
    MAX_PARTICLES: MAX_PARTICLES,
    isReduced: isReduced, particlesFor: particlesFor, budget: budget, specs: specs, glyph: glyph,
    getLayer: getLayer, burst: burst, shake: shake, ring: ring, mark: mark, bubble: bubble, thinking: thinking
  };
})(Ailand.core);
