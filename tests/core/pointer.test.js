(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.core.Pointer;

  function pt(id, x, y, t) { return { pointerId: id, x: x, y: y, t: t }; }

  // Minimal element stand-in: records listeners and dispatches fake pointer events.
  function fakeEl() {
    var ls = {};
    return {
      ls: ls,
      addEventListener: function (n, f) { (ls[n] = ls[n] || []).push(f); },
      removeEventListener: function (n, f) { ls[n] = (ls[n] || []).filter(function (g) { return g !== f; }); },
      fire: function (n, e) { (ls[n] || []).slice().forEach(function (f) { f(e); }); },
      count: function () { var c = 0; for (var k in ls) { c += ls[k].length; } return c; }
    };
  }
  function ev(type, id, x, y, t, extra) {
    var e = { pointerType: type, pointerId: id, clientX: x, clientY: y, timeStamp: t, button: 0, isPrimary: true };
    for (var k in extra) { e[k] = extra[k]; }
    return e;
  }

  describe('core Pointer.classify', function () {
    it('small, quick, same pointer is a tap', function () {
      expect(P.classify(pt(1, 10, 10, 0), pt(1, 22, 10, 800))).toBe('tap');
    });
    it('moving 13px is cancel', function () {
      expect(P.classify(pt(1, 10, 10, 0), pt(1, 23, 10, 100))).toBe('cancel');
      expect(P.classify(pt(1, 0, 0, 0), pt(1, 9, 9, 100))).toBe('cancel');
    });
    it('another pointerId is cancel', function () {
      expect(P.classify(pt(1, 10, 10, 0), pt(2, 10, 10, 100))).toBe('cancel');
    });
    it('longer than 800ms is cancel; missing down is cancel', function () {
      expect(P.classify(pt(1, 10, 10, 0), pt(1, 10, 10, 801))).toBe('cancel');
      expect(P.classify(null, pt(1, 10, 10, 1))).toBe('cancel');
    });
  });

  describe('core Pointer.attach', function () {
    function setup() {
      var el = fakeEl(), log = [];
      var detach = P.attach(el, {
        onHover: function (x, y, type) { log.push(['hover', x, y, type]); },
        onTap: function (x, y, type) { log.push(['tap', x, y, type]); },
        onLeave: function () { log.push(['leave']); }
      });
      return { el: el, log: log, detach: detach };
    }
    it('mouse move hovers, mouse click taps, mouse leave leaves', function () {
      var s = setup();
      s.el.fire('pointermove', ev('mouse', 1, 5, 6, 0));
      s.el.fire('pointerdown', ev('mouse', 1, 5, 6, 10));
      s.el.fire('pointerup', ev('mouse', 1, 6, 6, 50));
      s.el.fire('pointerleave', ev('mouse', 1, 6, 6, 60));
      expect(s.log).toEqual([['hover', 5, 6, 'mouse'], ['tap', 6, 6, 'mouse'], ['leave']]);
    });
    it('touch does not hover and its pointerleave after up is ignored', function () {
      var s = setup();
      s.el.fire('pointermove', ev('touch', 3, 5, 6, 0));
      s.el.fire('pointerdown', ev('touch', 3, 5, 6, 0));
      s.el.fire('pointerup', ev('touch', 3, 5, 6, 100));
      s.el.fire('pointerleave', ev('touch', 3, 5, 6, 100));
      expect(s.log).toEqual([['tap', 5, 6, 'touch']]);
    });
    it('drag, pointercancel and non-primary mouse buttons do not tap', function () {
      var s = setup();
      s.el.fire('pointerdown', ev('pen', 4, 0, 0, 0));
      s.el.fire('pointerup', ev('pen', 4, 20, 0, 50));
      s.el.fire('pointerdown', ev('touch', 5, 0, 0, 0));
      s.el.fire('pointercancel', ev('touch', 5, 0, 0, 10));
      s.el.fire('pointerup', ev('touch', 5, 0, 0, 20));
      s.el.fire('pointerdown', ev('mouse', 1, 0, 0, 0, { button: 2 }));
      s.el.fire('pointerup', ev('mouse', 1, 0, 0, 20, { button: 2 }));
      expect(s.log).toEqual([]);
    });
    function setupPress() {
      var el = fakeEl(), log = [];
      P.attach(el, {
        onPress: function (x, y, type, id) { log.push(['press', x, y, type, id]); },
        onTap: function (x, y, type) { log.push(['tap', x, y, type]); }
      });
      return { el: el, log: log };
    }
    it('press reports on pointerdown with pointerId', function () {
      var s = setupPress();
      s.el.fire('pointerdown', ev('touch', 7, 5, 6, 0));
      expect(s.log).toEqual([['press', 5, 6, 'touch', 7]]);
    });
    it('two pointers pressing at once both report', function () {
      var s = setupPress();
      s.el.fire('pointerdown', ev('touch', 1, 5, 6, 0));
      s.el.fire('pointerdown', ev('touch', 2, 50, 60, 5));
      expect(s.log).toEqual([['press', 5, 6, 'touch', 1], ['press', 50, 60, 'touch', 2]]);
    });
    it('right mouse button does not press', function () {
      var s = setupPress();
      s.el.fire('pointerdown', ev('mouse', 1, 0, 0, 0, { button: 2 }));
      expect(s.log).toEqual([]);
    });
    it('press does not change tap', function () {
      var s = setupPress();
      s.el.fire('pointerdown', ev('touch', 3, 5, 6, 0));
      s.el.fire('pointerup', ev('touch', 3, 5, 6, 50));
      expect(s.log).toEqual([['press', 5, 6, 'touch', 3], ['tap', 5, 6, 'touch']]);
    });
    it('detach removes every listener', function () {
      var s = setup();
      expect(s.el.count() > 0).toBe(true);
      s.detach();
      expect(s.el.count()).toBe(0);
    });
  });
})(window.Ailand);
