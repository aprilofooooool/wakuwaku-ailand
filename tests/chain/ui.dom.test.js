(function (A) {
  'use strict';
  // Browser only: builds the chain UI in a fixed box and drives the buttons with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.chain;
  var STEP = A.core.Loop.STEP_MS;

  function fakeStorage(difficulty, time) {
    var m = {};
    m[G.Controller.SETTINGS_KEY] = { char: 'mametchi', difficulty: difficulty || 'easy', seenHowTo: true };
    if (time) { m[G.Controller.TIME_KEY] = time; }
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

  function make(difficulty, time) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = G.Controller.create({ bus: bus, storage: fakeStorage(difficulty, time), seed: function () { return 7; } });
    var linePicker = A.core.LinePicker.create({ gameLines: G.Lines, commonLines: A.core.CommonLines, rng: function () { return 0; } });
    var ui = G.UI.init(box, controller, { bus: bus, loop: fakeLoop(), linePicker: linePicker, rng: function () { return 0.5; } });
    return {
      box: box, bus: bus, controller: controller, ui: ui,
      done: function () { ui.destroy(); box.remove(); }
    };
  }
  function buttonByText(root, text) {
    return Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return b.textContent.trim() === text; })[0];
  }
  function run(t, ms) { for (var s = 0; s < ms; s += STEP) { t.controller.advance(STEP); } }
  function play(t) {
    buttonByText(t.box, 'はじめる').click();
    var ms = 0;
    while (ms < 5000 && t.controller.phase() !== 'playing') { t.controller.advance(STEP); ms += STEP; }
    expect(t.controller.phase()).toBe('playing');
  }
  function pad(t, action) { return t.box.querySelector('.ch-pad button[data-action="' + action + '"]'); }
  function ptr(el, type, id) {
    var r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: type !== 'pointerleave', pointerId: id, pointerType: 'touch', isPrimary: id === 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    }));
  }
  function x(t) { return t.controller.game().pair.x; }
  function boxOf(el) { return el.getBoundingClientRect(); }
  function overlaps(a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }

  // Loads the real game page in a w x h iframe, starts a round (how-to skipped, saved settings restored after) and calls check(doc).
  function inFrame(w, h, check) {
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
          var doc = frame.contentDocument;
          store = frame.contentWindow.Ailand.core.Storage.create('chain');
          saved = store.get(G.Controller.SETTINGS_KEY, null);
          store.set(G.Controller.SETTINGS_KEY, { char: 'mametchi', difficulty: 'easy', seenHowTo: true });
          Array.prototype.filter.call(doc.querySelectorAll('button'), function (b) { return b.textContent.trim() === 'はじめる'; })[0].click();
          setTimeout(function () { try { check(doc); resolve(); } catch (e) { reject(e); } }, 300);
        } catch (e) { reject(e); }
      };
      frame.src = '../games/chain/index.html';
      document.body.appendChild(frame);
    }).then(cleanup, function (e) { cleanup(); throw e; });
  }
  // No scroll, pads >= 64px and on screen, the board on screen and big enough, the start bubble off the board.
  function checkPlayScreen(doc, minCell) {
    var de = doc.documentElement;
    expect(doc.getElementById('screen-game').hidden).toBe(false);
    expect(de.scrollHeight <= de.clientHeight).toBe(true);
    expect(de.scrollWidth <= de.clientWidth).toBe(true);
    Array.prototype.forEach.call(doc.querySelectorAll('.ch-pad button'), function (b) {
      var r = b.getBoundingClientRect();
      expect(r.width >= 64 && r.height >= 64).toBe(true);
      expect(r.bottom <= de.clientHeight && r.right <= de.clientWidth).toBe(true);
    });
    var c = boxOf(doc.querySelector('.ch-board'));
    expect(c.bottom <= de.clientHeight && c.right <= de.clientWidth).toBe(true);
    expect(c.width / G.Constants.COLS >= minCell).toBe(true);
    var friends = boxOf(doc.querySelector('.ch-friends'));
    expect(friends.bottom <= de.clientHeight && friends.right <= de.clientWidth).toBe(true);
    var bubble = doc.querySelector('.ch-say .fx-bubble');
    expect(!!bubble).toBe(true);   // the start line is showing
    expect(overlaps(boxOf(bubble), c)).toBe(false);
  }

  describe('chain UI (browser)', function () {
    it('settings screen shows characters, difficulty and start', function () {
      var t = make('easy', { easy: 83 });
      try {
        var s = t.box.querySelector('.ch-settings-screen');
        expect(s.querySelectorAll('.ch-charbtn').length).toBe(4);
        var levels = s.querySelectorAll('.ch-level');
        expect(levels.length).toBe(3);
        ['かんたん', 'ふつう', 'むずかしい'].forEach(function (label, i) { expect(levels[i].textContent.indexOf(label)).toBe(0); });
        expect(levels[0].textContent.indexOf('4にん おこそう') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('2ぷん30びょう') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('ベスト 1:23') >= 0).toBe(true);
        expect(levels[1].textContent.indexOf('ベスト') < 0).toBe(true);
        expect(levels[2].textContent.indexOf('ねがえりするよ') >= 0).toBe(true);
        expect(levels[0].textContent.indexOf('ねがえり') < 0).toBe(true);
        expect(!!buttonByText(s, 'はじめる')).toBe(true);
        expect(!!buttonByText(s, 'あそびかた')).toBe(true);
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
      } finally { t.done(); }
    });

    it('buttons are in the order left soft hard rotate right', function () {
      var t = make();
      try {
        play(t);
        var acts = Array.prototype.map.call(t.box.querySelectorAll('.ch-pad button'), function (b) { return b.getAttribute('data-action'); });
        expect(acts.join(',')).toBe('left,soft,hard,rotate,right');
      } finally { t.done(); }
    });

    it('holding the left button moves the pair and release stops it', function () {
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
        var x0 = x(t), r0 = t.controller.game().pair.rot;
        ptr(left, 'pointerdown', 1);
        ptr(rot, 'pointerdown', 2);
        ptr(rot, 'pointerup', 2);   // the second finger lifts; the first stays down
        expect(t.controller.game().pair.rot).toBe((r0 + 1) % 4);
        var x1 = x(t);
        expect(x1).toBe(x0 - 1);
        run(t, 190);
        expect(x(t)).toBe(x1 - 1);
        ptr(left, 'pointerup', 1);
      } finally { t.done(); }
    });

    it('the friends panel counts down as each woken face lands', function () {
      var t = make();
      var fly = G.Fx.fly, lands = [];
      G.Fx.fly = function (from, to, pf, size, o) { lands.push(o.onLand); return null; };
      try {
        play(t);
        var left = t.box.querySelector('.ch-left');
        expect(left.textContent).toBe('のこり 4にん');
        t.bus.emit('wake', { type: 'wake', cells: [{ col: 0, row: 12, charId: 'kuchipatchi' }, { col: 1, row: 12, charId: 'mimitchi' }], left: 2 });
        expect(lands.length).toBe(2);
        expect(left.textContent).toBe('のこり 4にん');
        lands[0]();
        expect(left.textContent).toBe('のこり 3にん');
        lands[1]();
        expect(left.textContent).toBe('のこり 2にん');
        expect(t.box.querySelectorAll('.ch-friendface').length).toBe(2);
      } finally { G.Fx.fly = fly; t.done(); }
    });

    it('fits 390x844 without scrolling', function () {
      return inFrame(390, 844, function (doc) { checkPlayScreen(doc, 24); });
    });

    it('fits 844x390 without scrolling', function () {
      return inFrame(844, 390, function (doc) { checkPlayScreen(doc, 12); });
    });
  });
})(window.Ailand);
