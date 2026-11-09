(function (O) {
  'use strict';

  // Scheduler that keeps the flush callbacks until run() is called (one "task" boundary).
  function manualScheduler() {
    var q = [];
    return { schedule: function (fn) { q.push(fn); }, count: function () { return q.length; },
      run: function () { var fns = q; q = []; fns.forEach(function (f) { f(); }); } };
  }
  // Records the pickEffect calls while fn runs, and returns them.
  function spyPick(fn) {
    var real = O.Reaction.pickEffect;
    var calls = [];
    O.Reaction.pickEffect = function () {
      var args = Array.prototype.slice.call(arguments);
      calls.push(args);
      return real.apply(null, args);
    };
    try { fn(); } finally { O.Reaction.pickEffect = real; }
    return calls;
  }
  function make(sched, picks, ctx) {
    return O.MoveReaction.create({
      context: function () { return ctx || { mode: 'duo', humans: undefined }; },
      onPick: function (p) { picks.push(p); },
      scheduler: sched.schedule
    });
  }

  describe('MoveReaction', function () {
    it('one pick per batch', function () {
      var s = manualScheduler(), picks = [];
      var r = make(s, picks);
      var a = { player: 'p1', emotion: 'joy' }, b = { player: 'p2', emotion: 'sadness' };
      r.mover('p1');
      r.emotion(a);
      r.emotion(b);
      expect(s.count()).toBe(1);
      s.run();
      expect(picks.length).toBe(1);
      expect(picks[0]).toEqual(O.Reaction.pickEffect([a, b], 'p1', null, 'duo', undefined));
    });
    it('normal emotions are ignored', function () {
      var s = manualScheduler(), picks = [];
      var r = make(s, picks);
      r.mover('p1');
      r.emotion({ player: 'p1', emotion: 'normal' });
      var calls = spyPick(function () { s.run(); });
      expect(calls[0][0]).toEqual([]);
      expect(picks.length).toBe(0);
    });
    it('mover is carried to a later flush', function () {
      var s = manualScheduler(), picks = [];
      var r = make(s, picks);
      r.mover('p2');
      expect(s.count()).toBe(0);
      s.run();
      r.emotion({ player: 'p1', emotion: 'anger' });
      var calls = spyPick(function () { s.run(); });
      expect(calls[0][1]).toBe('p2');
    });
    it('mover resets after flush', function () {
      var s = manualScheduler(), picks = [];
      var r = make(s, picks);
      r.mover('p2');
      r.emotion({ player: 'p1', emotion: 'anger' });
      s.run();
      r.emotion({ player: 'p1', emotion: 'joy' });
      var calls = spyPick(function () { s.run(); });
      expect(calls[0][1]).toBe(null);
    });
    it('over is passed', function () {
      var s = manualScheduler(), picks = [];
      var r = make(s, picks, { mode: 'solo', humans: undefined });
      var over = { winner: 'p1' };
      r.over(over);
      r.emotion({ player: 'p1', emotion: 'joy' });
      var calls = spyPick(function () { s.run(); });
      expect(calls[0][2]).toBe(over);
      expect(calls[0][3]).toBe('solo');
      expect(picks).toEqual([{ player: 'p1', emotion: 'joy' }]);
    });
  });
})(Ailand.games.othello);
