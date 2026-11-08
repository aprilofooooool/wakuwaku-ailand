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
  var rings = [];         // kept rings on the winning discs (removed by stop)
  var winPieces = [];
  var pendingResolve = null;

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
    rings.forEach(function (r) { if (r.parentNode) { r.parentNode.removeChild(r); } });
    winPieces.forEach(function (p) { p.classList.remove('is-win'); });
    rings = [];
    winPieces = [];
    if (pendingResolve) { var done = pendingResolve; pendingResolve = null; done(); }
  }

  // Persistent rings on the winning discs; removed by stop(). Also used when viewing the finished board.
  function keepRings(els) {
    (els || []).forEach(function (p) { p.classList.add('is-win'); winPieces.push(p); rings.push(F.ring(p, { keep: true })); });
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

  // Resolves when the display is gone (fade end, tap to skip, or stop()).
  function ending(picked, ctx) {
    var persp = picked.perspective;
    var g = newGroup('d4-end is-' + persp);
    var promise = new Promise(function (resolve) { pendingResolve = resolve; });
    g.el.addEventListener('click', stop);
    var seats = Object.keys(ctx.seats).map(Number);
    var text, row;
    if (persp === 'win') {
      var winners = ((ctx.result && ctx.result.seats) || [picked.event.seat]).slice(0, 4);
      keepRings(ctx.winEls);
      row = heroes(winners, ctx, 'joy', true);
      if (winners.length > 1) { row.classList.add('multi'); }
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
    var textEl = el('p', 'd4-end-text', text);
    g.el.appendChild(row);
    g.el.appendChild(textEl);
    if (persp === 'win') { place(g, row, textEl, ctx, winners.length); }
    fadeOutAt(g, END_MS);
    return promise;
  }

  var HERO_GAP = 8;        // gap between heroes (.d4-heroes gap)
  var TEXT_GAP = 12;       // gap between heroes and caption (.d4-end gap)
  var EDGE = 8;            // margin to the header and the viewport bottom
  var BOUNCE = 0.05;       // d4-hero keyframes lift the hero by 5% of its size

  // Pure. Hero size for n winners: one hero is min(60vw, 70vh); several are min(36vw, 40vh) each,
  // wrapped in rows of the full width. All are shrunk so heroes + bounce fit in `avail` px of height.
  // Returns { size, rows, height, bounce } (height = rows of heroes, without bounce or caption).
  function heroSize(o) {
    var n = Math.max(1, o.n || 1);
    var size = n > 1 ? Math.min(0.36 * o.vw, 0.4 * o.vh) : Math.min(0.6 * o.vw, 0.7 * o.vh);
    var perRow = n > 1 ? Math.max(1, Math.floor((o.vw + HERO_GAP) / (size + HERO_GAP))) : 1;
    var rows = Math.ceil(n / perRow);
    var fit = ((o.avail - (rows - 1) * HERO_GAP) / rows) / (1 + BOUNCE);
    size = Math.max(40.5, Math.min(size, fit));  // shrinking only adds room per row, so rows never grows
    return { size: size, rows: rows, height: rows * size + (rows - 1) * HERO_GAP, bounce: size * BOUNCE };
  }

  // Pure. Top (px) of a block heroH tall: inside [headerBottom + margin, vh - margin], on the side of the
  // winning line with more room when it fits there (centered in that side), else centered in the viewport.
  function heroTop(o) {
    var m = o.margin, minTop = o.headerBottom + m, maxTop = o.vh - m - o.heroH;
    var above = { from: minTop, to: o.lineTop - m };
    var below = { from: o.lineBottom + m, to: o.vh - m };
    var sides = [above, below].filter(function (r) { return r.to - r.from >= o.heroH; })
      .sort(function (a, b) { return (b.to - b.from) - (a.to - a.from); });
    var top = sides.length ? sides[0].from + (sides[0].to - sides[0].from - o.heroH) / 2 : (o.vh - o.heroH) / 2;
    return Math.max(minTop, Math.min(maxTop, top));
  }

  // Sizes the winner heroes to the free height and puts the block (heroes + caption) fully inside the
  // viewport below the header, beside the winning line when there is room (otherwise over the board).
  function place(g, row, textEl, ctx, n) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var hdr = document.querySelector ? document.querySelector('.app-header') : null;
    var headerBottom = hdr ? hdr.getBoundingClientRect().bottom : 0;
    var capH = textEl.getBoundingClientRect().height || 56;
    var hs = heroSize({ vw: vw, vh: vh, n: n, avail: vh - headerBottom - 2 * EDGE - TEXT_GAP - capH });
    if (n > 1) { row.style.setProperty('--d4-hero-s', hs.size + 'px'); }
    else { row.style.width = hs.size + 'px'; row.style.maxWidth = 'none'; }
    var minY = Infinity, maxY = -Infinity;
    (ctx.winEls || []).forEach(function (p) { var r = p.getBoundingClientRect(); minY = Math.min(minY, r.top); maxY = Math.max(maxY, r.bottom); });
    if (minY === Infinity) { minY = maxY = vh / 2; }
    var blockH = hs.bounce + hs.height + TEXT_GAP + capH;
    var top = heroTop({ vh: vh, headerBottom: headerBottom, heroH: blockH, lineTop: minY, lineBottom: maxY, margin: EDGE });
    g.el.classList.add('at-top');
    g.el.style.paddingTop = (top + hs.bounce) + 'px';
  }

  // picked: controller's reaction.picked ({event, perspective}) or null.
  // ctx: { seats: {seat: {box, face, profile}}, boardEl, winEls, result, humans }
  function play(picked, ctx) {
    if (!picked) { return undefined; }
    var kind = picked.event.kind;
    // Task 16 sound hook: one call site, e.g. Ailand.core.Sound && Ailand.core.Sound.play(kind).
    if (kind === 'win' || kind === 'lose' || kind === 'draw') { return ending(picked, ctx); }
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

  G.Fx = { play: play, drop: drop, dropMs: dropMs, stop: stop, keepRings: keepRings, heroSize: heroSize, heroTop: heroTop };
})(Ailand.games.drop4);
