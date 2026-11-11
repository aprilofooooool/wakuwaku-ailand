(function (G) {
  'use strict';
  // whack effects (design 5.3): full-screen banners (3-2-1, スタート, last 10 s), rare sparkles, confetti,
  // and the in-hole points popup. Shared particles live in core/effects.js.
  var F = Ailand.core.Effects;
  var FADE_MS = 300;
  var POINTS_MS = 700;

  var banner = null;      // the one full-screen banner on screen
  var timers = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function removeBanner() {
    if (banner && banner.parentNode) { banner.parentNode.removeChild(banner); }
    banner = null;
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    removeBanner();
  }

  // Big centered text over the whole screen for `ms`, then a fade. A new banner replaces the old one.
  function showBanner(text, cls, ms) {
    stop();
    var b = el('div', 'fx-group wk-banner' + (cls ? ' ' + cls : ''));
    b.appendChild(el('span', 'wk-banner-text', text));
    F.getLayer().appendChild(b);
    banner = b;
    later(function () {
      b.classList.add('fx-out');
      later(function () { if (banner === b) { removeBanner(); } }, FADE_MS);
    }, ms);
  }

  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Rare card: gold particles flying out of the hole (fx layer is fixed at the viewport, so client = layer px).
  function sparkleAt(holeEl) { return F.burst(F.getLayer(), 'sparkle', centerOf(holeEl)); }

  // Victory / new record: confetti over the whole screen.
  function confetti() { return F.burst(F.getLayer(), 'confetti'); }

  // "+1" / "+5" / "−3" floating up inside the hole.
  function pointsPop(holeEl, points) {
    var p = el('span', 'wk-pts' + (points < 0 ? ' is-minus' : ''), (points < 0 ? '−' + (-points) : '+' + points));
    p.setAttribute('aria-hidden', 'true');
    holeEl.appendChild(p);
    setTimeout(function () { if (p.parentNode) { p.parentNode.removeChild(p); } }, POINTS_MS);
    return p;
  }

  G.Fx = { showBanner: showBanner, sparkleAt: sparkleAt, confetti: confetti, pointsPop: pointsPop, stop: stop };
})(Ailand.games.whack);
