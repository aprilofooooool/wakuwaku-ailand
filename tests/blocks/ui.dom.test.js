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

  function make() {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = B.Controller.create({ bus: bus, storage: fakeStorage(true), seed: function () { return 7; } });
    var ui = B.UI.init(box, controller, { bus: bus, loop: fakeLoop(), rng: function () { return 0.5; } });
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
      var frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:9999;background:#fff';
      var saved = null, store = null;
      return new Promise(function (resolve, reject) {
        frame.onload = function () {
          try {
            var w = frame.contentWindow, doc = frame.contentDocument;
            // Keep the real saved settings: skip the how-to card for this check, restore afterwards.
            store = w.Ailand.core.Storage.create('blocks');
            saved = store.get(B.Controller.SETTINGS_KEY, null);
            store.set(B.Controller.SETTINGS_KEY, { char: 'mametchi', difficulty: 'easy', seenHowTo: true });
            var start = Array.prototype.filter.call(doc.querySelectorAll('button'), function (b) { return b.textContent.trim() === 'はじめる'; })[0];
            start.click();
            setTimeout(function () {
              try {
                var de = doc.documentElement;
                expect(doc.getElementById('screen-game').hidden).toBe(false);
                expect(de.scrollHeight <= de.clientHeight).toBe(true);
                expect(de.scrollWidth <= de.clientWidth).toBe(true);
                Array.prototype.forEach.call(doc.querySelectorAll('.bl-pad button'), function (b) {
                  var r = b.getBoundingClientRect();
                  expect(r.width >= 64 && r.height >= 64).toBe(true);
                  expect(r.bottom <= de.clientHeight && r.right <= de.clientWidth).toBe(true);
                });
                var c = doc.querySelector('.bl-board').getBoundingClientRect();
                expect(c.bottom <= de.clientHeight && c.right <= de.clientWidth).toBe(true);
                resolve();
              } catch (e) { reject(e); }
            }, 200);
          } catch (e) { reject(e); }
        };
        frame.src = '../games/blocks/index.html';
        document.body.appendChild(frame);
      }).then(function () { cleanup(); }, function (e) { cleanup(); throw e; });
      function cleanup() {
        if (store) { if (saved === null) { store.remove(B.Controller.SETTINGS_KEY); } else { store.set(B.Controller.SETTINGS_KEY, saved); } }
        frame.remove();
      }
    });
  });
})(window.Ailand);
