(function (G) {
  'use strict';
  // territory full-screen effects (design 5.1): one effect per move, drawn on the shared #fx-layer.
  // Shared pieces (particles, ring) live in core/effects.js. Reduced motion: no confetti, no sparkles.
  var F = Ailand.core.Effects;
  var MINI_MS = 1400;     // small pop / tag length before it fades
  var WIN_MS = 2800;      // confetti length
  var FADE_MS = 300;

  var group = null;       // the one effect that is on screen
  var timers = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    if (group && group.parentNode) { group.parentNode.removeChild(group); }
    group = null;
  }

  function newGroup(cls) {
    stop();
    group = el('div', 'fx-group ' + cls);
    F.getLayer().appendChild(group);
    return group;
  }

  function fadeOutAt(g, ms) {
    later(function () {
      g.classList.add('fx-out');
      later(function () { if (g === group) { stop(); } }, FADE_MS);
    }, ms);
  }

  function centerOf(node) {
    var r = node ? node.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function pop(g, glyph, text, at, cls) {
    var b = el('div', 'tr-pop ' + (cls || ''), glyph);
    if (text) { b.appendChild(el('span', 'tr-pop-text', text)); }
    b.style.left = at.x + 'px';
    b.style.top = at.y + 'px';
    g.appendChild(b);
  }

  // screen: null | 'block' | 'big' | 'mark' | 'rest' | 'endgame' | 'win' | 'lose' | 'draw' (controller reaction).
  // ctx: { at: {x, y} centre of the piece just placed (client px), boardEl, cardOf(seat) -> element,
  //        blocked: [seats], resting: [seats] }.
  // 'endgame' has no picture (the BGM tempo changes); 'lose' and 'draw' are the result screen alone.
  function play(screen, ctx) {
    var c = ctx || {}, reduced = F.isReduced(), g, at = c.at || centerOf(c.boardEl);
    if (screen === 'win') {
      g = newGroup('tr-fx-win');
      if (!reduced) { F.burst(g, 'confetti'); }
      fadeOutAt(g, WIN_MS);
    } else if (screen === 'big') {
      g = newGroup('tr-fx-mini');
      pop(g, F.glyph('sparkle'), '', at, 'is-small');
      if (!reduced) { F.burst(g, 'sparkle', at); }
      fadeOutAt(g, MINI_MS);
    } else if (screen === 'block' || screen === 'mark') {
      g = newGroup('tr-fx-mini');
      pop(g, F.glyph('shield'), screen === 'block' ? 'とおせんぼ！' : '', at, 'is-small');
      if (screen === 'block' && c.cardOf) { (c.blocked || []).forEach(function (s) { F.ring(c.cardOf(s)); }); }
      fadeOutAt(g, MINI_MS);
    } else if (screen === 'rest') {
      g = newGroup('tr-fx-mini');
      (c.resting || []).forEach(function (s) {
        var card = c.cardOf && c.cardOf(s);
        if (card) { pop(g, '', 'おやすみ', centerOf(card), 'is-tag'); }
      });
      fadeOutAt(g, MINI_MS);
    }
  }

  G.Fx = { play: play, stop: stop };
})(Ailand.games.territory);
