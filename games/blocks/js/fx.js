(function (G) {
  'use strict';
  // blocks effects (design 5.2, 5.3): full-screen banners (3-2-1, スタート), flying faces, the board flash and
  // confetti. Flying faces live on the core fx layer (fixed to the viewport, so client px = layer px).
  var C = Ailand.core, F = C.Effects;
  var FADE_MS = 300;
  var FLY_MS = 700;       // css .bl-fly animation length
  var STILL_MS = 450;     // reduced motion: the face fades where it was
  var FLASH_MS = 650;     // css .bl-boardframe.is-flash
  var DECO = ['♪', '♡', '✦'];

  var banner = null;
  var timers = [];
  var flyers = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function drop(node) { if (node && node.parentNode) { node.parentNode.removeChild(node); } }

  function removeBanner() { drop(banner); banner = null; }

  // Removes banners and every flying face (their onLand is not called).
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    removeBanner();
    flyers.forEach(drop);
    flyers = [];
  }

  // Big centered text for `ms`, then a fade. A new banner replaces the old one.
  function showBanner(text, cls, ms) {
    removeBanner();
    var b = el('div', 'fx-group bl-banner' + (cls ? ' ' + cls : ''));
    b.appendChild(el('span', 'bl-banner-text', text));
    F.getLayer().appendChild(b);
    banner = b;
    later(function () {
      b.classList.add('fx-out');
      later(function () { if (banner === b) { removeBanner(); } }, FADE_MS);
    }, ms);
  }

  // One happy face (joy image) hops out of a cell and glides to `to` (design 5.2). Both points are client px.
  // opts: { delay (ms), deco index, onLand() }. Reduced motion: it fades where it is and lands at once.
  function fly(from, to, profile, size, opts) {
    var o = opts || {};
    var reduced = F.isReduced();
    var outer = el('div', 'bl-fly');
    outer.style.left = from.x + 'px';
    outer.style.top = from.y + 'px';
    outer.style.setProperty('--size', size + 'px');
    outer.style.setProperty('--dx', (to.x - from.x) + 'px');
    outer.style.setProperty('--dy', (to.y - from.y) + 'px');
    outer.style.setProperty('--d', (o.delay || 0) + 'ms');
    var inner = el('div', 'bl-fly-in');
    var img = el('img', 'char-img');
    img.draggable = false;
    inner.appendChild(img);
    C.CharacterView.apply(img, profile, 'joy');
    var deco = el('span', 'bl-fly-deco', DECO[(o.deco || 0) % DECO.length]);
    inner.appendChild(deco);
    outer.appendChild(inner);
    F.getLayer().appendChild(outer);
    flyers.push(outer);
    function done() {
      drop(outer);
      flyers = flyers.filter(function (f) { return f !== outer; });
    }
    if (reduced) {
      outer.classList.add('is-still');
      if (o.onLand) { o.onLand(); }
      later(function () { outer.classList.add('fx-out'); }, 30);
      later(done, STILL_MS + 30);
      return outer;
    }
    later(function () { done(); if (o.onLand) { o.onLand(); } }, (o.delay || 0) + FLY_MS);
    return outer;
  }

  // Quad clear: the board shines once. Nothing in reduced motion.
  function flash(frame) {
    if (!frame || F.isReduced()) { return; }
    frame.classList.remove('is-flash');
    void frame.offsetWidth;
    frame.classList.add('is-flash');
    later(function () { frame.classList.remove('is-flash'); }, FLASH_MS);
  }

  // Goal: confetti over the whole screen (stopped in reduced motion, Global Constraints).
  function confetti() { return F.isReduced() ? 0 : F.burst(F.getLayer(), 'confetti'); }

  G.Fx = { showBanner: showBanner, fly: fly, flash: flash, confetti: confetti, stop: stop, FLY_MS: FLY_MS };
})(Ailand.games.blocks);
