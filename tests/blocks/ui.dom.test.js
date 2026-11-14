(function (A) {
  'use strict';
  // Browser only: builds the blocks UI in a fixed box and drives the buttons with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var B = A.games.blocks;
  var STEP = A.core.Loop.STEP_MS;

  function fakeStorage(seen) {
    var m = {};
    if (seen) { m[B.Controller.SETTINGS_KEY] = { char: 'mametchi', difficulty: 'easy', seenHowTo: true }; }
    return {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  function fakeLoop() {
    var on = false;
    return { start: function () { on = true; }, stop: function () { on = false; }, isRunning: function () { return on; } };
  }

  function make(withLines) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = B.Controller.create({ bus: bus, storage: fakeStorage(true), seed: function () { return 7; } });
    var deps = { bus: bus, loop: fakeLoop(), rng: function () { return 0.5; } };
    if (withLines) { deps.linePicker = A.core.LinePicker.create({ gameLines: B.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } }); }
    var ui = B.UI.init(box, controller, deps);
    return {
      box: box, controller: controller, ui: ui,
      done: function () { ui.destroy(); box.remove(); }
    };
  }
  function buttonByText(root, text) {
    return Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return b.textContent.trim() === text; })[0];
  }
  function run(t, ms) { for (var s = 0; s < ms; s += STEP) { t.controller.advance(STEP); } }
  // Starts a round and runs the 3-2-1 countdown.
  function play(t) {
    buttonByText(t.box, 'はじめる').click();
    var ms = 0;
    while (ms < 5000 && t.controller.phase() !== 'playing') { t.controller.advance(STEP); ms += STEP; }
    expect(t.controller.phase()).toBe('playing');
  }
  function pad(t, action) { return t.box.querySelector('.bl-pad button[data-action="' + action + '"]'); }
  function ptr(el, type, id) {
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: type !== 'pointerleave', pointerId: id, pointerType: 'touch', isPrimary: id === 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
  }
  function x(t) { return t.controller.game().piece.x; }
  function key(type, k) { document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); }
  // One clear on the bottom row: `mine` of the 6 side cells are mametchi (the chosen character), an I piece fills the rest.
  function setupClear(t, mine) {
    var g = t.controller.game();
    g.board.forEach(function (row) { for (var c = 0; c < B.Constants.COLS; c++) { row[c] = null; } });
    [0, 1, 2, 7, 8, 9].forEach(function (c, i) { g.board[21][c] = { charId: i < mine ? 'mametchi' : 'kuchipatchi' }; });
    g.piece = { shape: 'I', charId: 'kuchipatchi', x: 3, y: 0, rot: 0 };
    return g;
  }
  // Replaces Fx.fly: records each landing callback instead of flying. Returns { lands, restore }.
  function holdFlights() {
    var fly = B.Fx.fly, lands = [];
    B.Fx.fly = function (from, to, pf, size, o) { lands.push(o.onLand); return null; };
    return { lands: lands, restore: function () { B.Fx.fly = fly; } };
  }
  function boxOf(el) { return el.getBoundingClientRect(); }
  function overlaps(a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // Loads the real game page in a w x h iframe, starts a round (how-to skipped, saved settings restored after) and calls check(doc).
  function inFrame(w, h, check) {
    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border:0;z-index:9999;background:#fff';
    var saved = null, store = null;
    function cleanup() {
      if (store) { if (saved === null) { store.remove(B.Controller.SETTINGS_KEY); } else { store.set(B.Controller.SETTINGS_KEY, saved); } }
      frame.remove();
    }
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        try {
          var doc = frame.contentDocument;
          store = frame.contentWindow.Ailand.core.Storage.create('blocks');
          saved = store.get(B.Controller.SETTINGS_KEY, null);
          store.set(B.Controller.SETTINGS_KEY, { char: 'mametchi', difficulty: 'easy', seenHowTo: true });
          Array.prototype.filter.call(doc.querySelectorAll('button'), function (b) { return b.textContent.trim() === 'はじめる'; })[0].click();
          setTimeout(function () { try { check(doc); resolve(); } catch (e) { reject(e); } }, 300);
        } catch (e) { reject(e); }
      };
      frame.src = '../games/blocks/index.html';
      document.body.appendChild(frame);
    }).then(cleanup, function (e) { cleanup(); throw e; });
  }
  // No scroll, pads >= 64px and on screen, the board on screen and big enough, and the start bubble off the board.
  function checkPlayScreen(doc, minCell) {
    var de = doc.documentElement;
    expect(doc.getElementById('screen-game').hidden).toBe(false);
    expect(de.scrollHeight <= de.clientHeight).toBe(true);
    expect(de.scrollWidth <= de.clientWidth).toBe(true);
    Array.prototype.forEach.call(doc.querySelectorAll('.bl-pad button'), function (b) {
      var r = b.getBoundingClientRect();
      expect(r.width >= 64 && r.height >= 64).toBe(true);
      expect(r.bottom <= de.clientHeight && r.right <= de.clientWidth).toBe(true);
    });
    var c = boxOf(doc.querySelector('.bl-board'));
    expect(c.bottom <= de.clientHeight && c.right <= de.clientWidth).toBe(true);
    expect(c.width / B.Constants.COLS >= minCell).toBe(true);
    var bubble = doc.querySelector('.bl-say .fx-bubble');
    expect(!!bubble).toBe(true);   // the start line is showing
    expect(overlaps(boxOf(bubble), c)).toBe(false);
  }

  describe('blocks UI (browser)', function () {
    it('settings screen shows characters, difficulty and start', function () {
      var t = make();
      try {
        var s = t.box.querySelector('.bl-settings-screen');
        expect(s.querySelectorAll('.bl-charbtn').length).toBe(4);
        expect(s.querySelectorAll('.bl-level').length).toBe(3);
        ['かんたん', 'ふつう', 'むずかしい'].forEach(function (label, i) {
          expect(s.querySelectorAll('.bl-level')[i].textContent.indexOf(label)).toBe(0);
        });
        expect(!!buttonByText(s, 'はじめる')).toBe(true);
        expect(!!buttonByText(s, 'あそびかた')).toBe(true);
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
      } finally { t.done(); }
    });

    it('holding the left button moves the piece and release stops it', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left');
        expect(getComputedStyle(left).touchAction).toBe('none');
        var x0 = x(t);
        ptr(left, 'pointerdown', 1);
        expect(x(t)).toBe(x0 - 1);
        run(t, 190);   // first repeat after 170 ms
        expect(x(t)).toBe(x0 - 2);
        ptr(left, 'pointerup', 1);
        run(t, 300);
        expect(x(t)).toBe(x0 - 2);
      } finally { t.done(); }
    });

    it('repeat stops on pointercancel and leave', function () {
      var t = make();
      try {
        play(t);
        var right = pad(t, 'right');
        var x0 = x(t);
        ptr(right, 'pointerdown', 1);
        ptr(right, 'pointercancel', 1);
        run(t, 300);
        expect(x(t)).toBe(x0 + 1);
        ptr(right, 'pointerdown', 3);
        ptr(right, 'pointerleave', 3);
        run(t, 300);
        expect(x(t)).toBe(x0 + 2);
      } finally { t.done(); }
    });

    it('two fingers: hold left and tap rotate', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left'), rot = pad(t, 'rotate');
        var x0 = x(t), r0 = t.controller.game().piece.rot;
        ptr(left, 'pointerdown', 1);
        ptr(rot, 'pointerdown', 2);
        ptr(rot, 'pointerup', 2);   // the second finger lifts; the first stays down
        expect(t.controller.game().piece.rot).toBe((r0 + 1) % 4);
        var x1 = x(t);
        expect(x1 <= x0 - 1).toBe(true);
        run(t, 190);
        expect(x(t)).toBe(x1 - 1);
        ptr(left, 'pointerup', 1);
      } finally { t.done(); }
    });

    it('fits 390x844 without scrolling', function () {
      return inFrame(390, 844, function (doc) { checkPlayScreen(doc, 20); });
    });

    it('fits 844x390 without scrolling', function () {
      return inFrame(844, 390, function (doc) { checkPlayScreen(doc, 12); });
    });

    it('window blur stops a key held down', function () {
      var t = make();
      try {
        play(t);
        var x0 = x(t);
        key('keydown', 'ArrowLeft');
        expect(x(t)).toBe(x0 - 1);
        window.dispatchEvent(new Event('blur'));
        run(t, 300);
        expect(x(t)).toBe(x0 - 1);
        key('keyup', 'ArrowLeft');
      } finally { t.done(); }
    });

    it('a key up does not stop a finger holding the same button', function () {
      var t = make();
      try {
        play(t);
        var left = pad(t, 'left');
        var x0 = x(t);
        ptr(left, 'pointerdown', 1);
        key('keyup', 'ArrowLeft');   // not held by the keyboard: the finger keeps repeating
        run(t, 190);
        expect(x(t)).toBe(x0 - 2);
        ptr(left, 'pointerup', 1);
      } finally { t.done(); }
    });

    it('a face landing after the result does not change the counts', function () {
      var t = make(), fl = holdFlights();
      return Promise.resolve().then(function () {
        play(t);
        var g = setupClear(t, 1);
        g.goal = 1;
        t.controller.press('hard');
        expect(fl.lands.length).toBe(10);
        run(t, 300);
        expect(t.controller.phase()).toBe('result');
        return wait(1100);   // the result waits at most 1 s for flying faces
      }).then(function () {
        expect(!!t.box.querySelector('.bl-result')).toBe(true);
        var star = t.box.querySelector('.bl-starcount').textContent, jar = t.box.querySelector('.bl-jarcount').textContent;
        fl.lands.forEach(function (f) { f(); });
        expect(t.box.querySelector('.bl-starcount').textContent).toBe(star);
        expect(t.box.querySelector('.bl-jarcount').textContent).toBe(jar);
        expect(t.box.querySelectorAll('.bl-mini').length).toBe(0);
      }).then(function () { fl.restore(); t.done(); }, function (e) { fl.restore(); t.done(); throw e; });
    });

    it('the almost line replaces a bubble that is still showing', function () {
      var t = make(true), fl = holdFlights();
      try {
        play(t);   // the start line is still up (2 s)
        var say = t.box.querySelector('.bl-say');
        expect(!!say.querySelector('.fx-bubble-line')).toBe(true);
        var g = setupClear(t, 1);
        g.collected = 8;   // easy goal 12: this clear leaves 3
        t.controller.press('hard');
        var lines = say.querySelectorAll('.fx-bubble-line:not(.fx-out) .fx-bubble-text');
        expect(lines.length).toBe(1);
        expect(B.Lines.mametchi.almost.indexOf(lines[0].textContent) >= 0).toBe(true);
      } finally { fl.restore(); t.done(); }
    });
  });
})(window.Ailand);
