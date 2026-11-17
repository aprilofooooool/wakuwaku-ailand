(function (A) {
  'use strict';
  // Browser only: builds the fill UI in a fixed box and drags pieces with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.fill, P = G.Piece;

  function fakeStorage(tab, zukan) {
    var m = {};
    m[G.Controller.SETTINGS_KEY] = { char: 'mametchi', tab: tab || 'easy', seenHowTo: true };
    if (zukan) { m[G.Controller.ZUKAN_KEY] = zukan; }
    return {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  function fakeLoop() {
    var on = false;
    return { starts: 0, start: function () { on = true; this.starts++; }, stop: function () { on = false; }, isRunning: function () { return on; } };
  }

  function make(tab, zukan) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = G.Controller.create({ bus: bus, storage: fakeStorage(tab, zukan), seed: function () { return 7; } });
    var linePicker = A.core.LinePicker.create({ gameLines: G.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } });
    var loop = fakeLoop();
    var ui = G.UI.init(box, controller, { bus: bus, loop: loop, linePicker: linePicker, rng: function () { return 0.5; } });
    return {
      box: box, bus: bus, controller: controller, ui: ui, loop: loop,
      done: function () { ui.destroy(); box.remove(); }
    };
  }
  function cards(t) { return t.box.querySelectorAll('.fl-card'); }
  function startFirst(t) {
    cards(t)[0].click();
    expect(t.controller.phase()).toBe('play');
  }
  function eng(t) { return t.controller.engine(); }
  function wrap(t) { return t.box.querySelector('.fl-game'); }
  function trayPiece(t, id) { return t.box.querySelector('.fl-tray [data-piece-id="' + id + '"]'); }
  function act(t, name) { return t.box.querySelector('.fl-act button[data-action="' + name + '"]'); }
  function board(t) { return t.box.querySelector('.fl-board'); }
  function cellPx(t) { return board(t).getBoundingClientRect().width / t.controller.puzzle().frame.w; }

  function ptr(el, type, id, x, y) {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0,
      clientX: x, clientY: y
    }));
  }
  // Presses 1 px inside the tray piece's top-left corner (so the grab point is the piece's corner).
  function down(t, id, pid) {
    var r = trayPiece(t, id).getBoundingClientRect();
    ptr(trayPiece(t, id), 'pointerdown', pid || 1, r.left + 1, r.top + 1);
  }
  // Pointer position that puts the dragged piece's top-left on board cell (x, y).
  function target(t, x, y) {
    var b = board(t).getBoundingClientRect(), c = cellPx(t);
    return { x: b.left + x * c + 1, y: b.top + y * c + 1 + G.UI.LIFT_PX };
  }
  function dragTo(t, x, y, pid) {
    var p = target(t, x, y);
    ptr(wrap(t), 'pointermove', pid || 1, p.x - 30, p.y - 30);
    ptr(wrap(t), 'pointermove', pid || 1, p.x, p.y);
    ptr(wrap(t), 'pointerup', pid || 1, p.x, p.y);
  }
  // First free spot where the piece fits in its current orientation.
  function freeSpot(t, id) {
    var e = eng(t), frame = t.controller.puzzle().frame, occ = e.occupied(), shape = e.shape(id);
    for (var y = 0; y < frame.h; y++) {
      for (var x = 0; x < frame.w; x++) { if (P.fits(frame, occ, shape, x, y)) { return { x: x, y: y }; } }
    }
    return null;
  }
  function trayIds(t) { return eng(t).inTray(); }
  // Pointer position on the first cell of a placed piece (its top-left grab point is that cell's corner).
  function boardPoint(t, id) {
    var at = eng(t).state(id).at, c0 = P.place(eng(t).shape(id), at.x, at.y)[0];
    var b = board(t).getBoundingClientRect(), c = cellPx(t);
    return { x: b.left + c0[0] * c + 1, y: b.top + c0[1] * c + 1 };
  }


  // Solves the picture through the controller (turn to the answer shape, drop on the answer spot).
  function key(cells) { return JSON.stringify(cells.slice().sort()); }
  function solveOne(t, id) {
    var ctl = t.controller, e = ctl.engine(), n = 0;
    var p = ctl.puzzle().pieces.filter(function (q) { return q.id === id; })[0];
    while (key(P.normalize(e.shape(id))) !== key(P.normalize(p.cells)) && n < 8) { ctl.turn(id, n === 3 ? 'flip' : 'rotate'); n++; }
    ctl.drop(id, p.answer.x, p.answer.y);
  }
  function solveAll(t) { t.controller.puzzle().pieces.forEach(function (p) { solveOne(t, p.id); }); }
  function withReduced(on, fn) {
    var orig = window.matchMedia;
    window.matchMedia = function (q) { return { matches: on && /reduced-motion/.test(q), addListener: function () {}, removeListener: function () {} }; };
    try { fn(); } finally { window.matchMedia = orig; }
  }
  function clearFx() { var l = document.getElementById('fx-layer'); if (l) { l.innerHTML = ''; } }
  function doneScreen(t) { return t.box.querySelector('.fl-done'); }
  function easyDone(except) {
    var z = {};
    G.Pictures.filter(function (p) { return p.level === 'easy' && p.id !== except; }).forEach(function (p) { z[p.id] = { done: true, sparkle: false }; });
    return z;
  }

  // Loads the real game page in a w x h iframe on the hard page, starts the picture/seed that makes `pieces`
  // pieces (how-to skipped, saved settings restored after) and calls check(doc).
  function inFrame(w, h, pieces, check) {
    var hard = G.Pictures.filter(function (p) { return p.level === 'hard'; });
    var pick = null;
    for (var i = 0; i < hard.length && !pick; i++) {
      for (var s = 1; s < 200 && !pick; s++) {
        if (G.Puzzle.make(hard[i], s + 1).pieces.length === pieces) { pick = { index: i, seed: s }; }
      }
    }
    if (!pick) { return Promise.reject(new Error('no hard picture makes ' + pieces + ' pieces')); }
    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border:0;z-index:9999;background:#fff';
    var saved = null, store = null;
    function cleanup() {
      if (store) { if (saved === null) { store.remove(G.Controller.SETTINGS_KEY); } else { store.set(G.Controller.SETTINGS_KEY, saved); } }
      frame.remove();
    }
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        try {
          var win = frame.contentWindow, doc = frame.contentDocument;
          store = win.Ailand.core.Storage.create('fill');
          saved = store.get(G.Controller.SETTINGS_KEY, null);
          store.set(G.Controller.SETTINGS_KEY, { char: 'mametchi', tab: 'hard', seenHowTo: true });
          // Rebuild the zukan with the stored tab, then fix the seed (main.js: floor(random * 2^32) + 1st start).
          doc.querySelectorAll('.fl-tab')[2].click();
          win.Math.random = function () { return pick.seed / 4294967296; };
          doc.querySelectorAll('.fl-card')[pick.index].click();
          setTimeout(function () { try { check(doc); resolve(); } catch (e) { reject(e); } }, 300);
        } catch (e) { reject(e); }
      };
      frame.src = '../games/fill/index.html';
      document.body.appendChild(frame);
    }).then(cleanup, function (e) { cleanup(); throw e; });
  }
  function inside(r, doc) {
    var de = doc.documentElement;
    return r.left >= 0 && r.top >= 0 && r.right <= de.clientWidth && r.bottom <= de.clientHeight;
  }
  function checkPlayScreen(doc, pieces) {
    var de = doc.documentElement;
    expect(doc.getElementById('screen-game').hidden).toBe(false);
    expect(de.scrollHeight <= de.clientHeight).toBe(true);
    expect(de.scrollWidth <= de.clientWidth).toBe(true);
    expect(inside(doc.querySelector('.fl-board').getBoundingClientRect(), doc)).toBe(true);
    var tray = doc.querySelector('.fl-tray').getBoundingClientRect();
    expect(inside(tray, doc)).toBe(true);
    var items = doc.querySelectorAll('.fl-tray [data-piece-id]');
    expect(items.length).toBe(pieces);
    Array.prototype.forEach.call(items, function (p) {
      var r = p.getBoundingClientRect();
      expect(r.left >= tray.left && r.right <= tray.right && r.top >= tray.top && r.bottom <= tray.bottom).toBe(true);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('.fl-act button, .fl-hint'), function (b) {
      var r = b.getBoundingClientRect();
      expect(r.width >= 64 && r.height >= 64).toBe(true);
      expect(inside(r, doc)).toBe(true);
    });
    expect(inside(doc.querySelector('.fl-face').getBoundingClientRect(), doc)).toBe(true);
  }

  describe('fill UI (browser)', function () {
    it('zukan shows characters, tabs and cards', function () {
      var t = make('easy', { apple: { done: true, sparkle: true } });
      try {
        var s = t.box.querySelector('.fl-zukan-screen');
        expect(s.querySelectorAll('.fl-charbtn').length).toBe(4);
        var tabs = s.querySelectorAll('.fl-tab');
        expect(tabs.length).toBe(3);
        ['かんたん', 'ふつう', 'むずかしい'].forEach(function (label, i) { expect(tabs[i].textContent).toBe(label); });
        expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
        var cs = cards(t);
        expect(cs.length).toBe(8);
        expect(cs[0].textContent.indexOf('りんご') >= 0).toBe(true);
        expect(cs[0].classList.contains('is-sparkle')).toBe(true);
        expect(cs[1].textContent.indexOf('？') >= 0).toBe(true);
        expect(cs[1].textContent.indexOf('いちご') < 0).toBe(true);
        expect(s.querySelector('.fl-count').textContent).toBe('できた 1／8');
        expect(s.querySelector('.fl-left').textContent).toBe('あと 7まい');
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
        tabs[1].click();
        expect(t.controller.loadSettings().tab).toBe('normal');
        expect(cards(t)[0].textContent.indexOf('？') >= 0).toBe(true);
      } finally { t.done(); }
    });

    it('restarts the loop when the page becomes visible again during play', function () {
      var t = make();
      function setHidden(h) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return h; } });
        document.dispatchEvent(new Event('visibilitychange'));
      }
      try {
        startFirst(t);
        t.loop.stop(); // core Loop stops itself while hidden
        var n = t.loop.starts;
        setHidden(true);
        expect(t.loop.starts).toBe(n);
        setHidden(false);
        expect(t.loop.starts).toBe(n + 1);
        expect(t.loop.isRunning()).toBe(true);
      } finally { delete document.hidden; t.done(); }
    });

    it('does not start the loop on return while on the zukan', function () {
      var t = make();
      try {
        var n = t.loop.starts;
        document.dispatchEvent(new Event('visibilitychange'));
        expect(t.loop.starts).toBe(n);
      } finally { t.done(); }
    });

    it('tapping a card starts the picture', function () {
      var t = make();
      try {
        startFirst(t);
        expect(t.box.querySelector('#screen-game').hidden).toBe(false);
        expect(t.box.querySelector('.fl-zukan-screen').hidden).toBe(true);
        expect(t.box.querySelectorAll('.fl-tray [data-piece-id]').length).toBe(t.controller.puzzle().pieces.length);
        var title = document.querySelector('.app-header .hdr-title').textContent;
        expect(title.indexOf('？') >= 0 && title.indexOf('1まいめ') >= 0).toBe(true);
      } finally { t.done(); }
    });

    it('dragging a tray piece onto the board places it', function () {
      var t = make();
      try {
        startFirst(t);
        var id = trayIds(t)[0], spot = freeSpot(t, id);
        down(t, id);
        dragTo(t, spot.x, spot.y);
        expect(eng(t).state(id).at).toEqual(spot);
        expect(!!trayPiece(t, id)).toBe(false);
        expect(!!t.box.querySelector('.fl-drag')).toBe(false);
      } finally { t.done(); }
    });

    it('dropping outside the board returns the piece', function () {
      var t = make();
      try {
        startFirst(t);
        var id = trayIds(t)[0], spot = freeSpot(t, id);
        var frame = t.controller.puzzle().frame;
        // half out of the frame (right edge): the right column of the piece is outside
        var w = 1 + Math.max.apply(null, eng(t).shape(id).map(function (c) { return c[0]; }));
        down(t, id);
        dragTo(t, frame.w - w + 1, spot.y);
        expect(eng(t).state(id).at).toBe(null);
        // a board piece dropped on the tray
        t.controller.drop(id, spot.x, spot.y);
        expect(eng(t).state(id).at).toEqual(spot);
        var b = boardPoint(t, id);
        ptr(board(t), 'pointerdown', 1, b.x, b.y);
        var tr = t.box.querySelector('.fl-tray').getBoundingClientRect();
        ptr(wrap(t), 'pointermove', 1, tr.left + 10, tr.top + 10);
        ptr(wrap(t), 'pointerup', 1, tr.left + 10, tr.top + 10);
        expect(eng(t).state(id).at).toBe(null);
        // off the screen
        down(t, id);
        ptr(wrap(t), 'pointermove', 1, -200, -200);
        ptr(wrap(t), 'pointerup', 1, -200, -200);
        expect(eng(t).state(id).at).toBe(null);
        expect(eng(t).placedCount()).toBe(0);
        expect(!!trayPiece(t, id)).toBe(true);
      } finally { t.done(); }
    });

    it('rotate and flip buttons act on the selected piece', function () {
      var t = make();
      try {
        startFirst(t);
        var id = trayIds(t)[0];
        down(t, id);
        ptr(wrap(t), 'pointerup', 1, 0, 0);   // no move: a tap selects
        var s0 = eng(t).state(id);
        expect(trayPiece(t, id).classList.contains('is-selected')).toBe(true);
        act(t, 'rotate').click();
        expect(eng(t).state(id).rot).toBe((s0.rot + 1) % 4);
        var s1 = eng(t).state(id);
        act(t, 'flip').click();
        expect(eng(t).state(id).flip).toBe(1 - s1.flip);
        expect(eng(t).state(id).at).toBe(null);
      } finally { t.done(); }
    });

    it('buttons look disabled without a selection', function () {
      var t = make();
      try {
        startFirst(t);
        ['rotate', 'flip'].forEach(function (a) {
          var r = act(t, a).getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
          expect(act(t, a).disabled).toBe(true);
        });
        var id = trayIds(t)[0];
        down(t, id);
        ptr(wrap(t), 'pointerup', 1, 0, 0);
        expect(act(t, 'rotate').disabled).toBe(false);
        expect(act(t, 'flip').disabled).toBe(false);
      } finally { t.done(); }
    });

    it('a second finger is ignored', function () {
      var t = make();
      try {
        startFirst(t);
        var ids = trayIds(t), a = ids[0], b = ids[1], spot = freeSpot(t, a);
        down(t, a, 1);
        down(t, b, 2);
        var far = target(t, 0, 0);
        ptr(wrap(t), 'pointermove', 2, far.x + 50, far.y + 50);
        ptr(wrap(t), 'pointerup', 2, far.x + 50, far.y + 50);
        expect(eng(t).state(b).at).toBe(null);
        expect(t.box.querySelectorAll('.fl-drag').length <= 1).toBe(true);
        dragTo(t, spot.x, spot.y, 1);
        expect(eng(t).state(a).at).toEqual(spot);
        expect(eng(t).state(b).at).toBe(null);
        expect(trayPiece(t, b).classList.contains('is-selected')).toBe(false);
      } finally { t.done(); }
    });

    it('only a lost capture on the drag element cancels', function () {
      var t = make();
      try {
        startFirst(t);
        var id = trayIds(t)[0], spot = freeSpot(t, id);
        t.controller.drop(id, spot.x, spot.y);
        var q = boardPoint(t, id);
        ptr(board(t), 'pointerdown', 1, q.x, q.y);
        ptr(wrap(t), 'pointermove', 1, q.x + 40, q.y + 40);
        // the board canvas loses its implicit touch capture; the event bubbles up to the wrap
        ptr(board(t), 'lostpointercapture', 1, q.x + 40, q.y + 40);
        expect(!!t.box.querySelector('.fl-drag')).toBe(true);
        expect(eng(t).state(id).at).toEqual(spot);
        ptr(wrap(t), 'lostpointercapture', 1, q.x + 40, q.y + 40);
        expect(!!t.box.querySelector('.fl-drag')).toBe(false);
        expect(eng(t).state(id).at).toBe(null);
      } finally { t.done(); }
    });

    it('pointercancel returns the piece', function () {
      var t = make();
      try {
        startFirst(t);
        var id = trayIds(t)[0], spot = freeSpot(t, id);
        t.controller.drop(id, spot.x, spot.y);
        var q = boardPoint(t, id);
        ptr(board(t), 'pointerdown', 1, q.x, q.y);
        ptr(wrap(t), 'pointermove', 1, q.x + 40, q.y + 40);
        ptr(wrap(t), 'pointermove', 1, q.x, q.y + G.UI.LIFT_PX);   // back over its own spot: the ghost shows
        expect(!!t.box.querySelector('.fl-drag')).toBe(true);
        expect(board(t).hasAttribute('data-ghost')).toBe(true);
        ptr(wrap(t), 'pointercancel', 1, q.x, q.y + G.UI.LIFT_PX);
        expect(eng(t).state(id).at).toBe(null);
        expect(!!trayPiece(t, id)).toBe(true);
        expect(!!t.box.querySelector('.fl-drag')).toBe(false);
        expect(board(t).hasAttribute('data-ghost')).toBe(false);
      } finally { t.done(); }
    });

    it('clearing shows the picture then the done screen', function () {
      withReduced(false, function () {
        clearFx();
        var t = make();
        try {
          startFirst(t);
          solveAll(t);
          expect(t.controller.phase()).toBe('done');
          expect(!!doneScreen(t)).toBe(false);
          expect(!!t.box.querySelector('.fl-reveal')).toBe(false);
          t.ui.step(700);                       // the pieces shine, then the picture floats in
          expect(!!t.box.querySelector('.fl-reveal')).toBe(true);
          expect(!!doneScreen(t)).toBe(false);
          t.ui.step(1000);                      // the name and the cheer
          expect(document.querySelector('.app-header .hdr-title').textContent).toBe('りんご');
          expect(document.querySelectorAll('#fx-layer .fx-p').length > 0).toBe(true);
          expect(!!doneScreen(t)).toBe(false);
          t.ui.step(2000);                      // the done screen
          var d = doneScreen(t);
          expect(!!d).toBe(true);
          expect(d.textContent.indexOf('りんご が できた！') >= 0).toBe(true);
          expect(d.textContent.indexOf('ずかんに はったよ') >= 0).toBe(true);
          expect(d.textContent.indexOf('キラキラ ゲット！') >= 0).toBe(true);
          expect(d.querySelector('.fl-next').textContent).toBe('つぎの え');
          expect(d.querySelector('.fl-tozukan').textContent).toBe('ずかんに もどる');
          Array.prototype.forEach.call(d.querySelectorAll('button'), function (b) {
            var r = b.getBoundingClientRect();
            expect(r.width >= 64 && r.height >= 64).toBe(true);
          });
        } finally { t.done(); clearFx(); }
      });
    });

    it('done screen says ぜんぶ できた when the page is complete, and no キラキラ after a hint', function () {
      var t = make('easy', easyDone('apple'));
      try {
        startFirst(t);
        t.controller.hint(function () { return 0; });
        solveAll(t);
        t.ui.step(6000);
        var d = doneScreen(t);
        expect(d.textContent.indexOf('かんたん ぜんぶ できた！') >= 0).toBe(true);
        expect(d.textContent.indexOf('キラキラ') < 0).toBe(true);
      } finally { t.done(); }
    });

    it('next picture opens the next unfinished one', function () {
      var t = make();
      try {
        startFirst(t);
        solveAll(t);
        t.ui.step(6000);
        doneScreen(t).querySelector('.fl-next').click();
        expect(t.controller.phase()).toBe('play');
        expect(!!doneScreen(t)).toBe(false);
        // apple is done, so the next unfinished one is the second easy picture
        expect(document.querySelector('.app-header .hdr-title').textContent.indexOf('2まいめ') >= 0).toBe(true);
        expect(t.box.querySelectorAll('.fl-tray [data-piece-id]').length).toBe(t.controller.puzzle().pieces.length);
        expect(t.controller.engine().placedCount()).toBe(0);
      } finally { t.done(); }
    });

    it('back to zukan shows the card as done', function () {
      var t = make();
      try {
        startFirst(t);
        solveAll(t);
        t.ui.step(6000);
        doneScreen(t).querySelector('.fl-tozukan').click();
        expect(t.box.querySelector('.fl-zukan-screen').hidden).toBe(false);
        expect(cards(t)[0].classList.contains('is-done')).toBe(true);
        expect(cards(t)[0].classList.contains('is-sparkle')).toBe(true);
        expect(t.box.querySelector('.fl-count').textContent).toBe('できた 1／8');
        expect(!!doneScreen(t)).toBe(false);
      } finally { t.done(); }
    });

    it('reduced motion skips the bounce and confetti', function () {
      function place(t) {
        startFirst(t);
        var id = trayIds(t)[0], spot = freeSpot(t, id);
        down(t, id);
        dragTo(t, spot.x, spot.y);
        expect(eng(t).state(id).at).toEqual(spot);
      }
      withReduced(false, function () {
        var t = make();
        try {
          place(t);
          expect(board(t).getAttribute('data-pop')).toBe('1');
          t.ui.step(1000);
          expect(board(t).hasAttribute('data-pop')).toBe(false);
        } finally { t.done(); }
      });
      withReduced(true, function () {
        clearFx();
        var t = make();
        try {
          place(t);
          expect(board(t).hasAttribute('data-pop')).toBe(false);
          t.controller.restart();
          solveAll(t);
          t.ui.step(50);                         // the picture shows at once, no shine
          expect(!!t.box.querySelector('.fl-reveal')).toBe(true);
          expect(board(t).classList.contains('is-glow')).toBe(false);
          t.ui.step(6000);
          expect(document.querySelectorAll('#fx-layer .fx-p').length).toBe(0);
          expect(!!doneScreen(t)).toBe(true);
        } finally { t.done(); clearFx(); }
      });
    });

    it('fits 390x844 without scrolling', function () {
      return inFrame(390, 844, 11, function (doc) { checkPlayScreen(doc, 11); });
    });

    it('fits 844x390 without scrolling', function () {
      return inFrame(844, 390, 11, function (doc) { checkPlayScreen(doc, 11); });
    });
  });
})(window.Ailand);
