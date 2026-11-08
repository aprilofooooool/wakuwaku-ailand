(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var P = A.core.Reaction;
  var PRIORITY = ['win', 'lose', 'draw', 'double', 'block', 'reach', 'endgame', 'place'];
  function ev(kind, seat, emotion, by) { return { kind: kind, seat: seat, emotion: emotion, by: by }; }
  function opts(humans, mover) {
    return { humans: humans, mover: mover, priority: PRIORITY, teamOf: function () { return null; } };
  }

  describe('core Reaction.pick', function () {
    it('returns null for no events', function () {
      expect(P.pick([], opts([1], 1))).toBe(null);
    });
    it('CPU-only winner is a lose perspective', function () {
      var r = P.pick([ev('win', 2, 'excited', 2), ev('lose', 1, 'sadness', 2)], opts([1], 2));
      expect(r.perspective).toBe('lose');
      expect(r.event.kind).toBe('win');
      expect(r.event.seat).toBe(2);
    });
    it('a human among the winners is a win perspective', function () {
      var events = [ev('win', 1, 'excited', 3), ev('win', 3, 'excited', 3), ev('lose', 2, 'sadness', 3), ev('lose', 4, 'sadness', 3)];
      var r = P.pick(events, opts([1, 2], 3));
      expect(r.perspective).toBe('win');
      expect(r.event.seat).toBe(1);
    });
    it('all-CPU game: the winner side is the perspective (win, not lose)', function () {
      var r = P.pick([ev('win', 2, 'excited', 2), ev('lose', 1, 'sadness', 2)], opts([], 2));
      expect(r.perspective).toBe('win');
      expect(r.event.kind).toBe('win');
      expect(r.event.seat).toBe(2);
      expect(P.pick([ev('draw', 1, 'joy', 2), ev('draw', 2, 'joy', 2)], opts([], 2)).perspective).toBe('draw');
    });
    it('draw perspective', function () {
      var r = P.pick([ev('draw', 1, 'joy', 2), ev('draw', 2, 'joy', 2)], opts([1], 2));
      expect(r.perspective).toBe('draw');
      expect(r.event.kind).toBe('draw');
    });
    it('block beats reach', function () {
      var events = [ev('reach', 1, 'joy', 1), ev('reach', 2, 'worried', 1), ev('block', 1, 'joy', 1), ev('block', 2, 'anger', 1)];
      var r = P.pick(events, opts([1, 2], 1));
      expect(r.event.kind).toBe('block');
      expect(r.perspective).toBe('normal');
    });
    it('double beats block; endgame beats place', function () {
      expect(P.pick([ev('block', 1, 'joy', 1), ev('double', 1, 'excited', 1)], opts([1], 1)).event.kind).toBe('double');
      expect(P.pick([ev('place', 1, 'normal', 1), ev('endgame', 1, 'thinking', 1)], opts([1], 1)).event.kind).toBe('endgame');
    });
    it('CPU mover with several humans: first human by seat order is the viewpoint', function () {
      var events = [ev('block', 3, 'joy', 3), ev('block', 2, 'anger', 3), ev('block', 1, 'anger', 3)];
      expect(P.pick(events, opts([2, 1], 3)).event.seat).toBe(1);
    });
    it('human mover is the viewpoint', function () {
      var events = [ev('reach', 2, 'worried', 1), ev('reach', 1, 'joy', 1)];
      expect(P.pick(events, opts([1, 2], 1)).event.seat).toBe(1);
    });
  });

  describe('core Reaction.createBatcher', function () {
    it('three synchronous pushes flush once with three events', function () {
      var queued = [], calls = [];
      var b = P.createBatcher(function (events) { calls.push(events); }, function (fn) { queued.push(fn); });
      b.push(1); b.push(2); b.push(3);
      expect(calls.length).toBe(0);
      expect(queued.length).toBe(1);
      queued[0]();
      expect(calls).toEqual([[1, 2, 3]]);
    });
    it('pushes after a flush start a new batch', function () {
      var queued = [], calls = [];
      var b = P.createBatcher(function (events) { calls.push(events); }, function (fn) { queued.push(fn); });
      b.push('a'); queued.shift()();
      b.push('b'); queued.shift()();
      expect(calls).toEqual([['a'], ['b']]);
    });
    it('default scheduler flushes on a later task', function () {
      return new Promise(function (resolve) {
        var calls = [];
        var b = P.createBatcher(function (events) { calls.push(events); });
        b.push(1); b.push(2);
        expect(calls.length).toBe(0);
        setTimeout(function () { expect(calls).toEqual([[1, 2]]); resolve(); }, 20);
      });
    });
  });
})(window.Ailand);
