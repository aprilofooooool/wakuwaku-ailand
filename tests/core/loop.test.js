(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Loop = A.core.Loop;

  // Fake raf queue, clock and document so the loop runs without a browser.
  function setup() {
    var f = { t: 0, queue: [], nextId: 1, steps: [], pauses: 0, listeners: {} };
    f.doc = {
      hidden: false,
      addEventListener: function (type, fn) { f.listeners[type] = fn; }
    };
    f.loop = Loop.create({
      onStep: function (ms) { f.steps.push(ms); },
      onPause: function () { f.pauses++; },
      raf: function (cb) { var id = f.nextId++; f.queue.push({ id: id, cb: cb }); return id; },
      caf: function (id) { f.queue = f.queue.filter(function (q) { return q.id !== id; }); },
      now: function () { return f.t; },
      doc: f.doc
    });
    f.frame = function (t) {
      f.t = t;
      var q = f.queue.shift();
      if (q) { q.cb(t); }
    };
    return f;
  }

  describe('Loop', function () {
    it('exposes the step constants', function () {
      expect(Loop.STEP_MS).toBe(1000 / 60);
      expect(Loop.MAX_STEPS).toBe(5);
    });
    it('steps at a fixed interval', function () {
      var f = setup();
      f.loop.start();
      f.frame(51);
      expect(f.steps.length).toBe(3);
      expect(f.steps.every(function (s) { return s === Loop.STEP_MS; })).toBe(true);
    });
    it('caps steps per frame', function () {
      var f = setup();
      f.loop.start();
      f.frame(1000);
      expect(f.steps.length).toBe(Loop.MAX_STEPS);
      f.frame(1017);
      expect(f.steps.length).toBe(Loop.MAX_STEPS + 1);
    });
    it('start after stop does not catch up', function () {
      var f = setup();
      f.loop.start();
      f.frame(17);
      f.loop.stop();
      f.t = 5000;
      f.loop.start();
      f.steps.length = 0;
      f.frame(5017);
      expect(f.steps.length).toBe(1);
    });
    it('hidden document stops and calls onPause', function () {
      var f = setup();
      f.loop.start();
      expect(f.loop.isRunning()).toBe(true);
      f.doc.hidden = true;
      f.listeners.visibilitychange();
      expect(f.pauses).toBe(1);
      expect(f.loop.isRunning()).toBe(false);
      f.frame(100);
      expect(f.steps.length).toBe(0);
    });
  });
})(Ailand);
