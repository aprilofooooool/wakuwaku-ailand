(function () {
  'use strict';
  var T = Ailand.core.IdleTimer;

  // Fake timers: advance(ms) fires due callbacks in order.
  function fakeTimers() {
    var now = 0, seq = 0, list = [];
    return {
      setTimeout: function (fn, ms) { var id = ++seq; list.push({ id: id, at: now + ms, fn: fn }); return id; },
      clearTimeout: function (id) { list = list.filter(function (t) { return t.id !== id; }); },
      advance: function (ms) {
        var end = now + ms;
        for (;;) {
          var due = list.filter(function (t) { return t.at <= end; }).sort(function (a, b) { return a.at - b.at; })[0];
          if (!due) { break; }
          list = list.filter(function (t) { return t !== due; });
          now = due.at;
          due.fn();
        }
        now = end;
      }
    };
  }
  function setup() {
    var c = { idle: 0, wake: 0 }, timers = fakeTimers();
    c.timers = timers;
    c.t = T.create({ ms: 20000, timers: timers, onIdle: function () { c.idle++; }, onWake: function () { c.wake++; } });
    return c;
  }

  describe('core/IdleTimer', function () {
    it('fires once after ms', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(19999);
      expect(c.idle).toBe(0);
      c.timers.advance(1);
      expect(c.idle).toBe(1);
      expect(c.t.state()).toBe('asleep');
      c.timers.advance(40000);
      expect(c.idle).toBe(1);
    });
    it('poke restarts counting', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(15000);
      c.t.poke();
      c.timers.advance(15000);
      expect(c.idle).toBe(0);
      c.timers.advance(5000);
      expect(c.idle).toBe(1);
    });
    it('wake once per turn', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(20000);
      c.t.poke();
      expect(c.wake).toBe(1);
      expect(c.t.state()).toBe('done');
      c.timers.advance(30000);
      c.t.poke();
      expect(c.idle).toBe(1);
      expect(c.wake).toBe(1);
    });
    it('pause and resume restart from zero', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(15000);
      c.t.pause();
      expect(c.t.state()).toBe('paused');
      c.timers.advance(30000);
      expect(c.idle).toBe(0);
      c.t.resume();
      c.timers.advance(19999);
      expect(c.idle).toBe(0);
      c.timers.advance(1);
      expect(c.idle).toBe(1);
    });
    it('stop wakes and turns off', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(20000);
      c.t.stop();
      expect(c.wake).toBe(1);
      expect(c.t.state()).toBe('off');
    });
    it('arm while the page is hidden waits until resume', function () {
      var c = { idle: 0 }, timers = fakeTimers(), hidden = true;
      var t = T.create({ ms: 20000, timers: timers, isHidden: function () { return hidden; },
        onIdle: function () { c.idle++; }, onWake: function () {} });
      t.arm();
      expect(t.state()).toBe('paused');
      timers.advance(30000);
      expect(c.idle).toBe(0);
      hidden = false;
      t.resume();
      timers.advance(19999);
      expect(c.idle).toBe(0);
      timers.advance(1);
      expect(c.idle).toBe(1);
    });
    it('stop while counting never fires', function () {
      var c = setup();
      c.t.arm();
      c.timers.advance(10000);
      c.t.stop();
      c.timers.advance(30000);
      expect(c.idle).toBe(0);
      expect(c.wake).toBe(0);
    });
  });
})();
