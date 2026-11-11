(function (A) {
  'use strict';
  // Browser only: builds the whack UI in a fixed box and drives it with real Pointer Events.
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var W = A.games.whack;
  var STEP = A.core.Loop.STEP_MS;

  function fakeStorage() {
    var m = {};
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
  // iPad landscape: 2 players play together.
  function ipad() { return { maxTouchPoints: 5, width: 1024, height: 768 }; }

  function make() {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:700px;z-index:9999;background:#fff';
    document.body.appendChild(box);
    var bus = A.core.EventBus.create();
    var controller = W.Controller.create({ bus: bus, storage: fakeStorage(), seed: function () { return 7; } });
    var ui = W.UI.init(box, controller, { bus: bus, loop: fakeLoop(), env: ipad });
    return {
      box: box, controller: controller, ui: ui,
      done: function () { ui.destroy(); box.remove(); }
    };
  }
  function buttonByText(root, text) {
    return Array.prototype.filter.call(root.querySelectorAll('button'), function (b) { return b.textContent.trim() === text; })[0];
  }
  function down(el, x, y, id) {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
  }
  function selfHole(area) { return area.querySelector('.wk-hole.is-up[data-kind="self"]'); }

  describe('whack UI (browser)', function () {
    it('settings screen shows players, characters and difficulty', function () {
      var t = make();
      try {
        var s = t.box.querySelector('.wk-settings-screen');
        expect(!!buttonByText(s, '1にん')).toBe(true);
        expect(!!buttonByText(s, '2にん')).toBe(true);
        expect(s.querySelectorAll('.wk-charbtn').length).toBe(4);
        ['かんたん', 'ふつう', 'むずかしい', 'はじめる'].forEach(function (label) { expect(!!buttonByText(s, label)).toBe(true); });
        Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) {
          var r = b.getBoundingClientRect();
          expect(r.width >= 64 && r.height >= 64).toBe(true);
        });
      } finally { t.done(); }
    });

    it('simultaneous presses on both sides both score', function () {
      var t = make();
      try {
        buttonByText(t.box, '2にん').click();
        buttonByText(t.box, 'はじめる').click();
        expect(t.controller.mode()).toBe('together');
        var areas = t.box.querySelectorAll('.wk-area');
        expect(areas.length).toBe(2);
        var ms = 0;
        while (ms < 20000 && !(t.controller.phase() === 'playing' && selfHole(areas[0]) && selfHole(areas[1]))) {
          t.controller.advance(STEP);
          ms += STEP;
        }
        var l = selfHole(areas[0]).getBoundingClientRect(), r = selfHole(areas[1]).getBoundingClientRect();
        down(areas[0], l.left + l.width / 2, l.top + l.height / 2, 1);
        down(areas[1], r.left + r.width / 2, r.top + r.height / 2, 2);   // second finger, first not lifted
        var scores = Array.prototype.map.call(t.box.querySelectorAll('.wk-score'), function (e) { return e.dataset.score; });
        expect(scores).toEqual(['1', '1']);
      } finally { t.done(); }
    });
  });
})(window.Ailand);
