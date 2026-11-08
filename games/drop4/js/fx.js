(function (G) {
  'use strict';
  // drop4 effects (requirements 3.9): disc drop, reach / block / double banners, ending display.
  // The shared pieces (particles, ring, marks) live in core/effects.js.
  var C = Ailand.core, F = C.Effects;
  var END_MS = 3200;      // ending display length before it fades
  var BANNER_MS = 1500;
  var FADE_MS = 300;

  var group = null;       // the one full-screen effect that is on screen
  var timers = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  // Fall time grows with the distance, capped so a tall board stays quick.
  function dropMs(rows) {
    return Math.min(900, 380 + 60 * Math.max(1, rows));
  }

  // Drops `discEl` (already placed in its landing cell) from `rows` cells above, with two bounces.
  // Resolves when it has settled; at once under reduced motion.
  function drop(discEl, rows) {
    if (F.isReduced()) { return Promise.resolve(); }
    return new Promise(function (resolve) {
      var cs = window.getComputedStyle(discEl);
      var cell = parseFloat(cs.getPropertyValue('--cell')) || 40;
      var gap = parseFloat(cs.getPropertyValue('--gap')) || 4;
      var ms = dropMs(rows);
      var done = false;
      function finish() {
        if (done) { return; }
        done = true;
        discEl.classList.remove('d4-drop');
        resolve();
      }
      discEl.style.setProperty('--fall', (rows * (cell + gap)) + 'px');
      discEl.style.setProperty('--d4-drop-dur', ms + 'ms');
      discEl.classList.add('d4-drop');
      discEl.addEventListener('animationend', finish);
      setTimeout(finish, ms + 120);
    });
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
    group = el('div', 'fx-group ' + (cls || ''));
    F.getLayer().appendChild(group);
    return { el: group };
  }

  function fadeOutAt(g, ms) {
    later(function () {
      g.el.classList.add('fx-out');
      later(function () { if (g.el === group) { stop(); } }, FADE_MS);
    }, ms);
  }

  function centerOf(node) {
    var r = node ? node.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function banner(g, glyph, text, at) {
    var b = el('div', 'd4-banner', glyph);
    if (text) { b.appendChild(el('span', 'd4-banner-text', text)); }
    b.style.left = at.x + 'px';
    b.style.top = at.y + 'px';
    g.el.appendChild(b);
  }

  function heroes(seatList, ctx, logical, spin) {
    var row = el('div', 'd4-heroes');
    seatList.forEach(function (s, i) {
      var v = ctx.seats[s];
      if (!v) { return; }
      var h = el('div', 'd4-hero' + (spin && i === 0 ? ' spin' : ''));
      var img = el('img', 'char-img');
      img.draggable = false;
      h.appendChild(img);
      row.appendChild(h);
      C.CharacterView.apply(img, v.profile, logical);
    });
    return row;
  }

  function ending(picked, ctx) {
    var persp = picked.perspective;
    var g = newGroup('d4-end is-' + persp);
    var seats = Object.keys(ctx.seats).map(Number);
    var text, row;
    if (persp === 'win') {
      var winners = ((ctx.result && ctx.result.seats) || [picked.event.seat]).slice(0, 4);
      (ctx.winEls || []).forEach(function (p) { p.classList.add('is-win'); F.ring(p); });
      row = heroes(winners, ctx, 'joy', true);
      ['a', 'b', 'c', 'd'].forEach(function (k) { row.appendChild(el('span', 'd4-spark ' + k, F.glyph('sparkle'))); });
      text = 'やったー！';
      F.burst(g.el, 'confetti');
    } else if (persp === 'lose') {
      var mine = (ctx.humans && ctx.humans.length ? ctx.humans : [picked.event.seat]).slice(0, 1);
      row = heroes(mine, ctx, 'sadness', false);
      text = 'おしかった！ つぎは がんばろう！';
    } else {
      row = heroes(seats.slice(0, 2), ctx, 'joy', false);
      text = 'ひきわけ！ いい しょうぶ！';
    }
    g.el.appendChild(row);
    g.el.appendChild(el('p', 'd4-end-text', text));
    fadeOutAt(g, END_MS);
  }

  // picked: controller's reaction.picked ({event, perspective}) or null.
  // ctx: { seats: {seat: {box, face, profile}}, boardEl, winEls, result, humans }
  function play(picked, ctx) {
    if (!picked) { return; }
    var kind = picked.event.kind;
    // Task 16 sound hook: one call site, e.g. Ailand.core.Sound && Ailand.core.Sound.play(kind).
    if (kind === 'win' || kind === 'lose' || kind === 'draw') { ending(picked, ctx); return; }
    if (kind !== 'reach' && kind !== 'block' && kind !== 'double') { return; }   // endgame / place: no full-screen effect
    var g = newGroup('d4-mini');
    var at = centerOf(ctx.boardEl);
    if (kind === 'reach') {
      banner(g, '！', 'リーチ！', at);
      F.burst(g.el, 'sparkle', at);
    } else if (kind === 'block') {
      banner(g, F.glyph('shield'), 'ブロック！', at);
      var seat = ctx.seats[picked.event.seat];
      if (seat) { F.ring(seat.box); }
    } else {
      banner(g, F.glyph('sparkle'), 'ダブル！', at);
      F.burst(g.el, 'sparkle', at);
    }
    fadeOutAt(g, BANNER_MS);
  }

  G.Fx = { play: play, drop: drop, dropMs: dropMs, stop: stop };
})(Ailand.games.drop4);
