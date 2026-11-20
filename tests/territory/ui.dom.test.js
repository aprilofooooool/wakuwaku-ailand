(function (A) {
  'use strict';
  // Browser only: builds the territory UI in a fixed box and drags pieces with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.territory, E = G.Engine, Ctl = G.Controller;

  function fakeStorage(seen) {
    var m = {};
    m[Ctl.SETTINGS_KEY] = { players: 2, level: 'weak', first: 'me', seenHowTo: seen !== false,
      seats: [{ seat: 1, charId: 'mametchi', human: true }, { seat: 2, charId: 'kuchipatchi', human: false }] };
    return {
      m: m,
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }

  // CPU moves wait in `timers` until flush() runs them.
  function make(opts) {
    var o = opts || {};
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var timers = [];
    var storage = o.storage || fakeStorage(o.seen);
    var controller = Ctl.create({
      bus: bus, storage: storage, rng: function () { return 0.5; },
      setTimeout: function (fn) { timers.push(fn); }
    });
    var linePicker = A.core.LinePicker.create({ gameLines: G.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } });
    var ui = G.UI.init(box, controller, { bus: bus, linePicker: linePicker });
    return {
      box: box, bus: bus, controller: controller, ui: ui, storage: storage,
      flush: function () { while (timers.length) { timers.shift()(); } },
      done: function () { ui.destroy(); box.remove(); closeModals(); }
    };
  }
  function closeModals() {
    var r = document.getElementById('modal-root');
    if (r) { r.innerHTML = ''; }
  }
  function settings(players, humans, first) {
    var ids = G.Constants.CHARS, seats = [];
    for (var s = 1; s <= players; s++) { seats.push({ seat: s, charId: ids[s - 1], human: humans.indexOf(s) >= 0 }); }
    return { players: players, seats: seats, level: 'weak', first: first || 'me' };
  }
  function trayPieces(t) { return t.box.querySelectorAll('.tr-tray [data-piece-id]'); }
  function trayPiece(t, id) { return t.box.querySelector('.tr-tray [data-piece-id="' + id + '"]'); }
  function wrap(t) { return t.box.querySelector('.tr-game'); }
  function board(t) { return t.box.querySelector('.tr-board'); }
  function act(t, name) { return t.box.querySelector('.tr-acts button[data-action="' + name + '"]'); }
  function cellPx(t) { return board(t).getBoundingClientRect().width / t.controller.state().size; }

  function ptr(el, type, id, x, y) {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0,
      clientX: x, clientY: y
    }));
  }
  function down(t, id) {
    var r = trayPiece(t, id).getBoundingClientRect();
    ptr(trayPiece(t, id), 'pointerdown', 1, r.left + r.width / 2, r.top + r.height / 2);
  }
  function tap(t, id) {
    down(t, id);
    ptr(wrap(t), 'pointerup', 1, 0, 0);
  }
  // Finger position that snaps a piece of w x h cells with its top-left on board cell (x, y).
  function target(t, x, y, w, h) {
    var b = board(t).getBoundingClientRect(), c = cellPx(t);
    return { x: b.left + (x + w / 2) * c, y: b.top + (y + h / 2) * c + G.Layout.LIFT_PX };
  }
  function dragTo(t, id, x, y, w, h) {
    down(t, id);
    var p = target(t, x, y, w, h);
    ptr(wrap(t), 'pointermove', 1, p.x - 30, p.y - 30);
    ptr(wrap(t), 'pointermove', 1, p.x, p.y);
    ptr(wrap(t), 'pointerup', 1, p.x, p.y);
  }
  function rect(el) { return el.getBoundingClientRect(); }

  // Loads the real game page in a w x h iframe, starts a 4-player game (14 x 14) with the how-to skipped,
  // and calls check(doc). Saved settings and game are put back afterwards.
  function inFrame(w, h, check) {
    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border:0;z-index:9999;background:#fff';
    // Same origin: the page's localStorage is this page's. The raw values are read before the page loads (it marks
    // the how-to seen) and put back as they were (other tests swap core Storage's backend, so it is not used here).
    var keys = ['ailand:territory:' + Ctl.SETTINGS_KEY, 'ailand:territory:' + Ctl.SAVE_KEY], saved = {};
    keys.forEach(function (k) { saved[k] = window.localStorage.getItem(k); });
    function cleanup() {
      keys.forEach(function (k) { if (saved[k] === null) { window.localStorage.removeItem(k); } else { window.localStorage.setItem(k, saved[k]); } });
      frame.remove();
    }
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        try {
          var win = frame.contentWindow, doc = frame.contentDocument;
          var store = win.Ailand.core.Storage.create('territory');
          var s = settings(4, [1]);
          s.seenHowTo = true;
          store.set(Ctl.SETTINGS_KEY, s);
          store.remove(Ctl.SAVE_KEY);
          frame.onload = function () {
            try {
              win = frame.contentWindow; doc = frame.contentDocument;
              doc.querySelector('.tr-start').click();
              setTimeout(function () { try { check(doc); resolve(); } catch (e) { reject(e); } }, 300);
            } catch (e) { reject(e); }
          };
          win.location.reload();
        } catch (e) { reject(e); }
      };
      frame.src = '../games/territory/index.html';
      document.body.appendChild(frame);
    }).then(cleanup, function (e) { cleanup(); throw e; });
  }
  function inside(r, doc) {
    var de = doc.documentElement;
    return r.left >= 0 && r.top >= 0 && r.right <= de.clientWidth && r.bottom <= de.clientHeight;
  }

  describe('territory UI (browser)', function () {
    it('fits 390x844 without scroll and cells are 24px or more', function () {
      return inFrame(390, 844, function (doc) {
        var de = doc.documentElement;
        expect(doc.getElementById('screen-game').hidden).toBe(false);
        expect(de.scrollHeight <= de.clientHeight).toBe(true);
        expect(de.scrollWidth <= de.clientWidth).toBe(true);
        var b = doc.querySelector('.tr-board').getBoundingClientRect();
        expect(inside(b, doc)).toBe(true);
        expect(b.width / 14 >= 24).toBe(true);
        ['.tr-tray', '.tr-cards', '.tr-tip', '.tr-acts'].forEach(function (sel) {
          expect(inside(doc.querySelector(sel).getBoundingClientRect(), doc)).toBe(true);
        });
        expect(doc.querySelectorAll('.tr-card').length).toBe(4);
        var tray = doc.querySelector('.tr-tray').getBoundingClientRect();
        Array.prototype.forEach.call(doc.querySelectorAll('.tr-tray [data-piece-id]'), function (p) {
          var r = p.getBoundingClientRect();
          expect(r.left >= tray.left && r.right <= tray.right && r.top >= tray.top && r.bottom <= tray.bottom).toBe(true);
        });
        Array.prototype.forEach.call(doc.querySelectorAll('.tr-acts button'), function (btn) {
          if (btn.hidden) { return; }
          expect(inside(btn.getBoundingClientRect(), doc)).toBe(true);
        });
      });
    });

    it('twelve pieces in the tray', function () {
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'me'));
        var items = trayPieces(t);
        expect(items.length).toBe(12);
        G.Pieces.LIST.forEach(function (p, i) { expect(items[i].getAttribute('data-piece-id')).toBe(p.id); });
      } finally { t.done(); }
    });

    it('buttons are 64px or more', function () {
      var t = make();
      try {
        Array.prototype.forEach.call(t.box.querySelectorAll('#screen-settings button'), function (b) {
          var r = rect(b);
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
        t.controller.start(settings(2, [1], 'me'));
        var n = 0;
        Array.prototype.forEach.call(t.box.querySelectorAll('.tr-acts button'), function (b) {
          if (b.hidden) { return; }
          var r = rect(b);
          n++;
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
        expect(n >= 2).toBe(true);
      } finally { t.done(); }
    });

    it('first move shows the big corner dot', function () {
      var t = make();
      var orig = G.Render.dots, calls = [];
      G.Render.dots = function (ctx, o) { calls.push(o); return orig.apply(this, arguments); };
      try {
        t.controller.start(settings(2, [1], 'me'));
        var last = calls[calls.length - 1];
        expect(last.dots).toEqual([{ x: 0, y: 0, big: true }]);
        expect(last.color).toBe(A.core.Characters.get('mametchi').colors.main);
        // after the first move the dots are small, and none on a CPU turn
        t.controller.input({ seat: 1, pieceId: 'p1', rot: 0, flip: 0, x: 0, y: 0 });
        last = calls[calls.length - 1];
        expect(last.dots.length).toBe(0);
        t.flush();
        last = calls[calls.length - 1];
        expect(last.dots.length > 0).toBe(true);
        expect(last.dots.every(function (d) { return d.big === false; })).toBe(true);
      } finally { G.Render.dots = orig; t.done(); }
    });

    it('dragging over the start corner places the piece', function () {
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'me'));
        dragTo(t, 'o4', 0, 0, 2, 2);
        expect(t.controller.state().board[0][0]).toBe(1);
        expect(t.controller.state().hands[1].indexOf('o4')).toBe(-1);
        expect(!!t.box.querySelector('.tr-drag')).toBe(false);
      } finally { t.done(); }
    });

    it('dropping on an illegal spot returns the piece and shows the tip', function () {
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'me'));
        dragTo(t, 'o4', 4, 4, 2, 2);
        expect(t.controller.state().placed[1]).toBe(0);
        expect(!!trayPiece(t, 'o4')).toBe(true);
        expect(!!t.box.querySelector('.tr-drag')).toBe(false);
        expect(t.box.querySelector('.tr-tip').textContent).toBe('さいしょは ひかってる すみから');
        // off the board: back to the tray without a tip
        t.ui.clearTip();
        dragTo(t, 'o4', 20, 20, 2, 2);
        expect(t.box.querySelector('.tr-tip').textContent).toBe('');
        // touching its own colour on a side
        dragTo(t, 'o4', 0, 0, 2, 2);
        t.flush();
        dragTo(t, 'p1', 2, 0, 1, 1);
        expect(t.controller.state().board[0][2]).toBe(0);
        expect(t.box.querySelector('.tr-tip').textContent).toBe('じぶんの いろと へんで くっつけちゃ だめ');
        dragTo(t, 'p1', 3, 3, 1, 1);
        expect(t.box.querySelector('.tr-tip').textContent).toBe('じぶんの いろと かどで つなげよう');
      } finally { t.done(); }
    });

    it('unplaceable pieces are gray', function () {
      var t = make();
      var orig = E.canPlace;
      E.canPlace = function (state, seat, id) { return id !== 'x5'; };
      try {
        t.controller.start(settings(2, [1], 'me'));
        expect(trayPiece(t, 'x5').classList.contains('is-off')).toBe(true);
        expect(trayPiece(t, 'i2').classList.contains('is-off')).toBe(false);
      } finally { E.canPlace = orig; t.done(); }
    });

    it('tray is locked on a cpu turn', function () {
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'them'));
        expect(t.controller.isBusy()).toBe(true);
        var tray = t.box.querySelector('.tr-tray');
        expect(tray.classList.contains('is-locked')).toBe(true);
        dragTo(t, 'o4', 10, 10, 2, 2);
        expect(t.controller.state().placed[1]).toBe(0);
        expect(!!t.box.querySelector('.tr-drag')).toBe(false);
        t.flush();
        expect(tray.classList.contains('is-locked')).toBe(false);
      } finally { t.done(); }
    });

    it('undo button only with one human and a cpu', function () {
      function undoShown(s) {
        var t = make();
        try {
          t.controller.start(s);
          var b = act(t, 'undo');
          return !!b && !b.hidden;
        } finally { t.done(); }
      }
      expect(undoShown(settings(2, [1]))).toBe(true);
      // after a human move: off on the CPU turn, on again on the human turn
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'me'));
        var u = act(t, 'undo');
        expect(u.getAttribute('aria-disabled')).toBe('true');
        t.controller.input({ seat: 1, pieceId: 'p1', rot: 0, flip: 0, x: 0, y: 0 });
        expect(t.controller.isBusy()).toBe(true);
        expect(u.getAttribute('aria-disabled')).toBe('true');
        t.flush();
        expect(t.controller.isBusy()).toBe(false);
        expect(u.getAttribute('aria-disabled')).toBe('false');
      } finally { t.done(); }
      expect(undoShown(settings(4, [1]))).toBe(true);
      expect(undoShown(settings(2, [1, 2]))).toBe(false);
      expect(undoShown(settings(3, [1, 3]))).toBe(false);
      expect(undoShown(settings(2, []))).toBe(false);
    });

    it('how-to shows only the first time', function () {
      var storage = fakeStorage(false);
      var t = make({ storage: storage });
      try {
        expect(!!document.querySelector('#modal-root .tr-howto-body')).toBe(true);
      } finally { t.done(); }
      t = make({ storage: storage });
      try {
        expect(!!document.querySelector('#modal-root .tr-howto-body')).toBe(false);
        t.box.querySelector('.tr-howto').click();
        expect(!!document.querySelector('#modal-root .tr-howto-body')).toBe(true);
      } finally { t.done(); }
    });

    it('rotate and flip change the tray piece', function () {
      var t = make();
      try {
        t.controller.start(settings(2, [1], 'me'));
        expect(act(t, 'rotate').disabled).toBe(true);
        expect(act(t, 'flip').disabled).toBe(true);
        tap(t, 'l4');
        expect(trayPiece(t, 'l4').classList.contains('is-selected')).toBe(true);
        expect(act(t, 'rotate').disabled).toBe(false);
        var c0 = trayPiece(t, 'l4').querySelector('canvas');
        var w0 = c0.width, h0 = c0.height;
        act(t, 'rotate').click();
        var p = trayPiece(t, 'l4');
        expect(p.getAttribute('data-rot')).toBe('1');
        expect(p.querySelector('canvas').width).toBe(h0);
        expect(p.querySelector('canvas').height).toBe(w0);
        act(t, 'flip').click();
        p = trayPiece(t, 'l4');
        expect(p.getAttribute('data-flip')).toBe('1');
        expect(p.getAttribute('data-rot')).toBe('3');
        // the dropped piece keeps the tray orientation: l4 rot 3 flip 1 is 3 x 2
        var shape = A.core.Piece.orient(G.Pieces.byId('l4').cells, 3, 1);
        var hit = shape.some(function (c) { return c[0] === 0 && c[1] === 0; });
        expect(hit).toBe(true);
        dragTo(t, 'l4', 0, 0, 3, 2);
        var last = t.controller.state();
        expect(last.placed[1]).toBe(4);
        A.core.Piece.place(shape, 0, 0).forEach(function (c) { expect(last.board[c[1]][c[0]]).toBe(1); });
      } finally { t.done(); }
    });
  });

  // ---- result screen and full-screen effects (Task 8) ----
  function overGame(t, screen, perspective, scores, winners, draw) {
    t.controller.start(settings(2, [1], 'me'));
    t.bus.emit('reaction', { events: [], picked: { event: { kind: perspective }, perspective: perspective }, lines: {}, screen: screen });
    t.bus.emit('gameover', { result: { scores: scores, winners: winners, draw: !!draw } });
  }
  function withReduced(on, fn) {
    var old = window.matchMedia;
    window.matchMedia = function (q) { return { matches: on && /reduce/.test(q), media: q, addListener: function () {}, removeListener: function () {} }; };
    try { fn(); } finally { window.matchMedia = old; }
  }
  function confettiCount() { var l = document.getElementById('fx-layer'); return l ? l.querySelectorAll('.fx-p').length : 0; }
  function clearFx() { A.games.territory.Fx.stop(); var l = document.getElementById('fx-layer'); if (l) { l.innerHTML = ''; } }

  describe('territory UI result screen (browser)', function () {
    it('game over shows the result screen in score order', function () {
      var t = make();
      try {
        withReduced(false, function () { overGame(t, 'win', 'win', { 1: 30, 2: 14 }, [1]); });
        var card = t.box.querySelector('.tr-result .tr-result-card');
        expect(!!card).toBe(true);
        expect(card.classList.contains('is-win')).toBe(true);
        expect(card.querySelectorAll('.tr-hero img').length).toBe(1);
        var rows = card.querySelectorAll('.tr-result-list li');
        expect(rows.length).toBe(2);
        expect(rows[0].textContent.indexOf('30マス') >= 0).toBe(true);
        expect(rows[1].textContent.indexOf('14マス') >= 0).toBe(true);
        expect(card.querySelector('.tr-again').textContent).toBe('もういちど');
        expect(card.querySelector('.tr-tosettings').textContent).toBe('せっていに もどる');
        expect(confettiCount() > 0).toBe(true);
      } finally { clearFx(); t.done(); }
    });

    it('cpu-only win shows the lose screen', function () {
      var t = make();
      try {
        withReduced(false, function () { overGame(t, 'lose', 'lose', { 1: 12, 2: 33 }, [2]); });
        var card = t.box.querySelector('.tr-result-card');
        expect(card.classList.contains('is-lose')).toBe(true);
        expect(card.textContent.indexOf('おしかった！') >= 0).toBe(true);
        var rows = card.querySelectorAll('.tr-result-list li');
        expect(rows[0].textContent.indexOf('33マス') >= 0).toBe(true);
        expect(confettiCount()).toBe(0);
      } finally { clearFx(); t.done(); }
    });

    it('draw shows the draw message', function () {
      var t = make();
      try {
        withReduced(false, function () { overGame(t, 'draw', 'draw', { 1: 22, 2: 22 }, [1, 2], true); });
        var card = t.box.querySelector('.tr-result-card');
        expect(card.classList.contains('is-draw')).toBe(true);
        expect(card.textContent.indexOf('いいしょうぶ！') >= 0).toBe(true);
        expect(card.querySelectorAll('.tr-hero img').length).toBe(2);
        expect(confettiCount()).toBe(0);
      } finally { clearFx(); t.done(); }
    });

    it('reduced motion has no confetti or blinking dots', function () {
      var t = make();
      try {
        withReduced(true, function () { overGame(t, 'win', 'win', { 1: 30, 2: 14 }, [1]); });
        expect(!!t.box.querySelector('.tr-result-card')).toBe(true);
        expect(confettiCount()).toBe(0);
        // the anchor dots: the stylesheet turns the blink off for reduced motion (static opacity 1)
        var off = false;
        Array.prototype.forEach.call(document.styleSheets, function (ss) {
          var rules; try { rules = ss.cssRules; } catch (e) { return; }
          Array.prototype.forEach.call(rules, function (r) {
            if (!r.media || !/reduce/.test(r.media.mediaText)) { return; }
            Array.prototype.forEach.call(r.cssRules, function (c) {
              if (c.selectorText === '.tr-dots' && c.style.animationName === 'none') { off = true; }
            });
          });
        });
        expect(off).toBe(true);
      } finally { clearFx(); t.done(); }
    });

    it('a restart clears the old tip and cpu-flash timers', function () {
      var t = make();
      var made = [], cleared = [], st = window.setTimeout, ct = window.clearTimeout;
      try {
        t.controller.start(settings(2, [1], 'me'));
        window.setTimeout = function (fn, ms) { var id = st(fn, ms); made.push(id); return id; };
        window.clearTimeout = function (id) { cleared.push(id); return ct(id); };
        dragTo(t, 'p1', 6, 6, 1, 1);   // not the start corner: shows the tip (its timer is made)
        expect(t.box.querySelector('.tr-tip').textContent !== '').toBe(true);
        var tipTimers = made.slice();
        expect(tipTimers.length > 0).toBe(true);
        t.controller.start(settings(2, [1], 'me'));
        tipTimers.forEach(function (id) { expect(cleared.indexOf(id) >= 0).toBe(true); });
        expect(t.box.querySelector('.tr-tip').textContent).toBe('');
      } finally { window.setTimeout = st; window.clearTimeout = ct; t.done(); }
    });
  });
  describe('territory UI effects and sounds (browser)', function () {
    function react(t, kind, screen, extra) {
      var ev = { kind: kind, seat: 1, emotion: 'joy', by: 1 };
      if (extra) { Object.keys(extra).forEach(function (k) { ev[k] = extra[k]; }); }
      var events = [ev];
      if (kind === 'rest') { events = [{ kind: 'rest', seat: 2, emotion: 'worried', by: 1 }]; }
      t.bus.emit('reaction', { events: events, picked: { event: events[0], perspective: kind }, lines: {}, screen: screen });
    }
    // Runs fn with Sound.play / Bgm.setTempo recorded; real audio is not touched.
    function spied(fn) {
      var S = A.core.Sound, B = A.core.Bgm, played = [], tempos = [], sp = S.play, st = B.setTempo;
      S.play = function (n) { played.push(n); };
      B.setTempo = function (b) { tempos.push(b); };
      try { fn(played, tempos); } finally { S.play = sp; B.setTempo = st; }
    }
    function groups() { var l = document.getElementById('fx-layer'); return l ? l.querySelectorAll('.fx-group').length : 0; }
    function started() { var t = make(); t.controller.start(settings(2, [1], 'me')); clearFx(); return t; }

    it('big shows a small sparkle pop', function () {
      var t = started();
      try {
        withReduced(false, function () { react(t, 'big', 'big'); });
        expect(!!document.querySelector('#fx-layer .tr-fx-mini .tr-pop')).toBe(true);
        expect(document.querySelectorAll('#fx-layer .fx-sparkle').length > 0).toBe(true);
      } finally { clearFx(); t.done(); }
    });
    it('block shows the shield pop with its words and rings the blocked card', function () {
      var t = started();
      try {
        withReduced(false, function () { react(t, 'block', 'block', { others: [2] }); });
        var pop = document.querySelector('#fx-layer .tr-pop');
        expect(!!pop && pop.textContent.indexOf('とおせんぼ！') >= 0).toBe(true);
        expect(t.box.querySelectorAll('.tr-card[data-seat="2"] .fx-ring').length).toBe(1);
      } finally { clearFx(); t.done(); }
    });
    it('mark shows the shield alone, without words or rings', function () {
      var t = started();
      try {
        withReduced(false, function () { react(t, 'block', 'mark', { others: [1] }); });
        var pop = document.querySelector('#fx-layer .tr-pop');
        expect(!!pop && pop.textContent.indexOf('とおせんぼ') < 0).toBe(true);
        expect(t.box.querySelectorAll('.fx-ring').length).toBe(0);
      } finally { clearFx(); t.done(); }
    });
    it('rest shows a tag over the resting card', function () {
      var t = started();
      try {
        withReduced(false, function () { react(t, 'rest', 'rest'); });
        var tag = document.querySelector('#fx-layer .tr-pop.is-tag');
        expect(!!tag && tag.textContent.indexOf('おやすみ') >= 0).toBe(true);
      } finally { clearFx(); t.done(); }
    });
    it('a new reaction replaces the previous effect (one group only)', function () {
      var t = started();
      try {
        withReduced(false, function () {
          react(t, 'big', 'big');
          react(t, 'block', 'block', { others: [2] });
        });
        expect(groups()).toBe(1);
        expect(document.querySelectorAll('#fx-layer .tr-pop').length).toBe(1);
        expect(document.querySelector('#fx-layer .tr-pop').textContent.indexOf('とおせんぼ！') >= 0).toBe(true);
        withReduced(false, function () { react(t, 'win', 'win'); });
        expect(groups()).toBe(1);
        expect(document.querySelectorAll('#fx-layer .tr-pop').length).toBe(0);
      } finally { clearFx(); t.done(); }
    });
    it('plays one sound per event kind', function () {
      var t = started();
      try {
        spied(function (played) {
          react(t, 'big', 'big');
          react(t, 'block', 'block', { others: [2] });
          react(t, 'rest', 'rest');
          expect(played.join(',')).toBe('territory-big,territory-block,territory-rest');
        });
        ['win', 'lose', 'draw'].forEach(function (k) {
          spied(function (played) {
            react(t, k, k);
            expect(played.join(',')).toBe('territory-' + k);
          });
        });
      } finally { clearFx(); t.done(); }
    });
    it('endgame speeds up the BGM and a new game puts the tempo back', function () {
      var t = started();
      try {
        spied(function (played, tempos) {
          react(t, 'endgame', 'endgame');
          expect(tempos[tempos.length - 1]).toBe(G.Sounds.ENDGAME_BPM);
          expect(groups()).toBe(0);
          t.controller.start(settings(2, [1], 'me'));
          expect(tempos[tempos.length - 1]).toBe(G.Sounds.BGM.bpm);
        });
      } finally { clearFx(); t.done(); }
    });
  });
})(window.Ailand);
