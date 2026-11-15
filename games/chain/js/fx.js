(function (G) {
  'use strict';
  // chain effects (design 5.2, 5.3): banners (3-2-1, スタート), flying woken friends, the pop sparkles, the
  // "Nれんさ！" text, the zzz of a turn, the board flash and confetti. Everything lives on the core fx layer
  // (fixed to the viewport, so client px = layer px). Reduced motion: nothing flies or shines; things fade in place.
  var C = Ailand.core, F = C.Effects;
  var FADE_MS = 300;
  var FLY_MS = 700;       // css .ch-fly animation length
  var STILL_MS = 450;     // reduced motion: the face fades where it was
  var FLASH_MS = 650;     // css .ch-boardframe.is-flash
  var BITS_MS = 700;      // css .ch-bit (pop sparkles)
  var CHAIN_MS = 1000;    // css .ch-chaintext
  var ZZZ_MS = 1200;      // css .ch-zzz
  var DECO = ['♪', '♡', '✦'];
  var BITS = ['✦', '♪'];
  var MAX_BITS = 12;

  var banner = null;
  var timers = [];
  var nodes = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function drop(node) { if (node && node.parentNode) { node.parentNode.removeChild(node); } }
  function forget(node) { drop(node); nodes = nodes.filter(function (n) { return n !== node; }); }
  // Puts a short-lived node on the fx layer at client point `at` and removes it after `ms`.
  function place(node, at, ms) {
    node.style.left = at.x + 'px';
    node.style.top = at.y + 'px';
    F.getLayer().appendChild(node);
    nodes.push(node);
    later(function () { forget(node); }, ms);
    return node;
  }

  function removeBanner() { drop(banner); banner = null; }

  // Removes banners and every effect node (onLand of flying faces is not called).
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    removeBanner();
    nodes.forEach(drop);
    nodes = [];
  }

  // Big centered text for `ms`, then a fade. A new banner replaces the old one.
  function showBanner(text, cls, ms) {
    removeBanner();
    var b = el('div', 'fx-group ch-banner' + (cls ? ' ' + cls : ''));
    b.appendChild(el('span', 'ch-banner-text', text));
    F.getLayer().appendChild(b);
    banner = b;
    later(function () {
      b.classList.add('fx-out');
      later(function () { if (banner === b) { removeBanner(); } }, FADE_MS);
    }, ms);
  }

  // A woken friend (joy image) hops out of its cell and glides to `to` (design 5.2). Both points are client px.
  // opts: { delay (ms), deco index, onLand() }. Reduced motion: it fades where it is and lands at once.
  function fly(from, to, profile, size, opts) {
    var o = opts || {};
    var reduced = F.isReduced();
    var outer = el('div', 'ch-fly');
    outer.style.left = from.x + 'px';
    outer.style.top = from.y + 'px';
    outer.style.setProperty('--size', size + 'px');
    outer.style.setProperty('--dx', (to.x - from.x) + 'px');
    outer.style.setProperty('--dy', (to.y - from.y) + 'px');
    outer.style.setProperty('--d', (o.delay || 0) + 'ms');
    var inner = el('div', 'ch-fly-in');
    var img = el('img', 'char-img');
    img.draggable = false;
    inner.appendChild(img);
    C.CharacterView.apply(img, profile, 'joy');
    inner.appendChild(el('span', 'ch-fly-deco', DECO[(o.deco || 0) % DECO.length]));
    outer.appendChild(inner);
    F.getLayer().appendChild(outer);
    nodes.push(outer);
    if (reduced) {
      outer.classList.add('is-still');
      if (o.onLand) { o.onLand(); }
      later(function () { outer.classList.add('fx-out'); }, 30);
      later(function () { forget(outer); }, STILL_MS + 30);
      return outer;
    }
    later(function () { forget(outer); if (o.onLand) { o.onLand(); } }, (o.delay || 0) + FLY_MS);
    return outer;
  }

  // Popped balls burst softly: a small ✦ or ♪ rises from each cell (at most MAX_BITS). Points are client px.
  function sparkles(points, size) {
    points.slice(0, MAX_BITS).forEach(function (at, i) {
      var b = el('span', 'ch-bit', BITS[i % BITS.length]);
      b.style.fontSize = Math.max(14, Math.round(size * 0.6)) + 'px';
      place(b, at, BITS_MS);
    });
  }

  // "Nれんさ！" near where the balls popped (a board event, not a screen effect: design 5.2).
  function chainText(at, n) { place(el('div', 'ch-chaintext', n + 'れんさ！'), at, CHAIN_MS); }

  // A turn: a "zzz" floats up from the new sleeper.
  function zzz(at) { place(el('div', 'ch-zzz', 'zzz'), at, ZZZ_MS); }

  // The board shines once (a 2 or 3+ chain). Nothing in reduced motion.
  function flash(frame) {
    if (!frame || F.isReduced()) { return; }
    frame.classList.remove('is-flash');
    void frame.offsetWidth;
    frame.classList.add('is-flash');
    later(function () { frame.classList.remove('is-flash'); }, FLASH_MS);
  }

  // Sparkles around a point (a 3+ chain, or friends woke up). Nothing in reduced motion.
  function sparkle(at) { return F.isReduced() ? 0 : F.burst(F.getLayer(), 'sparkle', at); }

  // Clear: confetti over the whole screen (stopped in reduced motion, Global Constraints).
  function confetti() { return F.isReduced() ? 0 : F.burst(F.getLayer(), 'confetti'); }

  G.Fx = {
    showBanner: showBanner, fly: fly, sparkles: sparkles, chainText: chainText, zzz: zzz,
    flash: flash, sparkle: sparkle, confetti: confetti, stop: stop, FLY_MS: FLY_MS
  };
})(Ailand.games.chain);
