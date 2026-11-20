(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var D = A.core.Drag;

  // Fake element: only the methods Drag touches. fire() calls the registered listeners.
  function fakeEl() {
    var ls = {}, el = { captured: [], released: [] };
    el.addEventListener = function (n, f) { (ls[n] = ls[n] || []).push(f); };
    el.removeEventListener = function (n, f) { ls[n] = (ls[n] || []).filter(function (g) { return g !== f; }); };
    el.setPointerCapture = function (id) { el.captured.push(id); };
    el.releasePointerCapture = function (id) { el.released.push(id); };
    el.fire = function (n, e) {
      e.type = n;
      e.preventDefault = e.preventDefault || function () {};
      if (e.target === undefined) { e.target = el; }
      (ls[n] || []).slice().forEach(function (f) { f(e); });
    };
    el.count = function () { return Object.keys(ls).reduce(function (s, k) { return s + ls[k].length; }, 0); };
    return el;
  }

  function setup(pickId) {
    var el = fakeEl(), log = [];
    var detach = D.attach(el, {
      pick: function () { return pickId; },
      onStart: function (id) { log.push('start:' + id); },
      onMove: function () { log.push('move'); },
      onEnd: function () { log.push('end'); },
      onCancel: function () { log.push('cancel'); }
    });
    return { el: el, log: log, detach: detach };
  }

  describe('core drag', function () {
    it('pick returning null does not start', function () {
      var s = setup(null);
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      s.el.fire('pointermove', { pointerId: 1 });
      s.el.fire('pointerup', { pointerId: 1 });
      expect(s.log).toEqual([]);
      expect(s.el.captured.length).toBe(0);
    });
    it('start move end in order', function () {
      var s = setup('a');
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      s.el.fire('pointermove', { pointerId: 1 });
      s.el.fire('pointerup', { pointerId: 1 });
      expect(s.log).toEqual(['start:a', 'move', 'end']);
      expect(s.el.captured).toEqual([1]);
    });
    it('a second finger is ignored', function () {
      var s = setup('a');
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      s.el.fire('pointerdown', { pointerId: 2, pointerType: 'touch' });
      s.el.fire('pointermove', { pointerId: 2 });
      s.el.fire('pointerup', { pointerId: 2 });
      expect(s.log).toEqual(['start:a']);
      s.el.fire('pointerup', { pointerId: 1 });
      expect(s.log).toEqual(['start:a', 'end']);
    });
    it('pointercancel calls onCancel', function () {
      var s = setup('a');
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      s.el.fire('pointercancel', { pointerId: 1 });
      s.el.fire('pointermove', { pointerId: 1 });
      expect(s.log).toEqual(['start:a', 'cancel']);
    });
    it('lostpointercapture calls onCancel', function () {
      var s = setup('a');
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      s.el.fire('lostpointercapture', { pointerId: 1, target: {} });   // a child: ignored
      expect(s.log).toEqual(['start:a']);
      s.el.fire('lostpointercapture', { pointerId: 1 });
      expect(s.log).toEqual(['start:a', 'cancel']);
    });
    it('detach stops all calls', function () {
      var s = setup('a');
      s.detach();
      expect(s.el.count()).toBe(0);
      s.el.fire('pointerdown', { pointerId: 1, pointerType: 'touch' });
      expect(s.log).toEqual([]);
    });
  });
})(window.Ailand);
