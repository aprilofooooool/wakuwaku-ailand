(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.drop4.Engine, R = A.games.drop4.Reactions;

  function mk(o) {
    var s = { players: 2, teams: false, popOut: false, blocks: false, firstSeat: 1 };
    for (var k in o) { s[k] = o[k]; }
    return E.create(s);
  }
  function drop(state, col) { return { type: 'drop', col: col, seat: E.currentSeat(state) }; }
  function play(state, cols) {
    cols.forEach(function (c) { state = E.apply(state, drop(state, c)); });
    return state;
  }
  // Applies one move and returns {before, move, after, events}.
  function step(state, move, ctx) {
    var after = E.apply(state, move);
    return { before: state, move: move, after: after, events: R.detect(state, move, after, ctx || { endgameFired: false }) };
  }
  function of(events, kind) { return events.filter(function (e) { return e.kind === kind; }); }
  function emo(events, kind, seat) {
    var f = of(events, kind).filter(function (e) { return e.seat === seat; });
    return f.length ? f[0].emotion : null;
  }
  function randomMove(state, rng) {
    var ms = E.legalMoves(state);
    return ms[Math.floor(rng() * ms.length)];
  }

  describe('drop4 reactions: reach / double', function () {
    it('reach: mover joy, other worried', function () {
      var s = play(mk({}), [0, 6, 0, 6]);
      var r = step(s, drop(s, 0));
      expect(emo(r.events, 'reach', 1)).toBe('joy');
      expect(emo(r.events, 'reach', 2)).toBe('worried');
      expect(of(r.events, 'double').length).toBe(0);
      expect(r.events.every(function (e) { return e.by === 1; })).toBeTruthy();
    });
    it('double: mover excited, other surprised, no reach', function () {
      var s = play(mk({}), [1, 1, 2, 2]);
      var r = step(s, drop(s, 3));
      expect(emo(r.events, 'double', 1)).toBe('excited');
      expect(emo(r.events, 'double', 2)).toBe('surprised');
      expect(of(r.events, 'reach').length).toBe(0);
    });
    it('persisting double threat after a quiet move fires nothing', function () {
      var s = play(mk({}), [1, 1, 2, 2, 3, 6]);
      var r = step(s, drop(s, 6));
      expect(of(r.events, 'double').length).toBe(0);
      expect(of(r.events, 'reach').length).toBe(0);
    });
    it('persisting single threat after a quiet move fires no reach', function () {
      var s = play(mk({}), [0, 6, 0, 6, 0, 5]);
      var r = step(s, drop(s, 4));
      expect(of(r.events, 'reach').length).toBe(0);
    });
    it('2 wins growing to 3 with a new column fires double', function () {
      var found = null;
      for (var seed = 1; seed < 3000 && !found; seed++) {
        var rng = A.core.Rng.mulberry32(seed), s = mk({ players: 4 });
        while (!s.result && !found) {
          var m = randomMove(s, rng), a = E.apply(s, m);
          if (!a.result) {
            var wb = E.immediateWins(s, m.seat), wa = E.immediateWins(a, m.seat);
            if (wb.length === 2 && wa.length === 3 && wa.some(function (c) { return wb.indexOf(c) < 0; })) { found = { b: s, m: m, a: a }; }
          }
          s = a;
        }
      }
      expect(!!found).toBe(true);
      expect(of(R.detect(found.b, found.m, found.a, { endgameFired: true }), 'double').length).toBe(4);
    });
    it('plain move yields only a place event', function () {
      var s = mk({});
      var r = step(s, drop(s, 3));
      expect(r.events.length).toBe(1);
      expect(r.events[0].kind).toBe('place');
      expect(r.events[0].seat).toBe(1);
    });
    it('team mode: teammate is not worried', function () {
      // Seats 1,3 are team 0; seats 2,4 are team 1. Seat 1 stacks three in column 0.
      var s = play(mk({ players: 4, teams: true }), [0, 9, 8, 7, 0, 9, 8, 7]);
      var r = step(s, drop(s, 0));
      expect(emo(r.events, 'reach', 1)).toBe('joy');
      expect(emo(r.events, 'reach', 3)).toBe(null);
      expect(emo(r.events, 'reach', 2)).toBe('worried');
      expect(emo(r.events, 'reach', 4)).toBe('worried');
    });
  });

  describe('drop4 reactions: block', function () {
    it('drop on the opponent winning column: mover joy, blocked anger', function () {
      var s = play(mk({}), [0, 6, 0, 6, 0]);
      var r = step(s, drop(s, 0));
      expect(emo(r.events, 'block', 2)).toBe('joy');
      expect(emo(r.events, 'block', 1)).toBe('anger');
    });
    it('a gray block counts too', function () {
      var s = play(mk({ blocks: true }), [0, 6, 0, 6, 0]);
      var r = step(s, { type: 'block', col: 0, seat: 2 });
      expect(emo(r.events, 'block', 2)).toBe('joy');
      expect(emo(r.events, 'block', 1)).toBe('anger');
    });
    it('no block when the column was not a threat', function () {
      var s = play(mk({}), [0, 6, 0, 6, 0]);
      expect(of(step(s, drop(s, 3)).events, 'block').length).toBe(0);
    });
  });

  describe('drop4 reactions: endgame', function () {
    function findCrossing(seed) {
      var rng = A.core.Rng.mulberry32(seed);
      var s = mk({}), total = s.cells.length;
      while (!s.result) {
        var m = randomMove(s, rng), after = E.apply(s, m);
        if (!after.result && E.emptyCount(s) * 4 > total && E.emptyCount(after) * 4 <= total) {
          return { before: s, move: m, after: after };
        }
        s = after;
      }
      return null;
    }
    it('fires once when empties reach a quarter of the board, for everyone', function () {
      var c = null;
      for (var seed = 1; seed < 50 && !c; seed++) { c = findCrossing(seed); }
      expect(!!c).toBe(true);
      var eg = of(R.detect(c.before, c.move, c.after, { endgameFired: false }), 'endgame');
      expect(eg.length).toBe(2);
      expect(eg.every(function (e) { return e.emotion === 'thinking'; })).toBeTruthy();
      expect(of(R.detect(c.before, c.move, c.after, { endgameFired: true }), 'endgame').length).toBe(0);
    });
    it('does not fire early', function () {
      var s = mk({});
      expect(of(step(s, drop(s, 3)).events, 'endgame').length).toBe(0);
    });
  });

  describe('drop4 reactions: win / lose / draw', function () {
    it('win: winner excited, others sadness (lose events)', function () {
      var s = play(mk({}), [0, 6, 0, 6, 0, 5]);
      var r = step(s, drop(s, 0));
      expect(emo(r.events, 'win', 1)).toBe('excited');
      expect(emo(r.events, 'lose', 2)).toBe('sadness');
      expect(of(r.events, 'reach').length).toBe(0);
    });
    it('team win by A1 alone: teammate A2 wins too, the other team loses', function () {
      var s = play(mk({ players: 4, teams: true }), [0, 5, 6, 7, 0, 5, 6, 7, 0, 5, 6, 7]);
      var r = step(s, drop(s, 0));
      expect(emo(r.events, 'win', 1)).toBe('excited');
      expect(emo(r.events, 'win', 3)).toBe('excited');
      expect(emo(r.events, 'lose', 3)).toBe(null);
      expect(emo(r.events, 'lose', 2)).toBe('sadness');
      expect(emo(r.events, 'lose', 4)).toBe('sadness');
      var picked = A.core.Reaction.pick(r.events, {
        humans: [3], mover: 1, priority: R.PRIORITY, teamOf: function (seat) { return E.teamOf(s, seat); }
      });
      expect(picked.perspective).toBe('win');
      expect(picked.event.seat).toBe(3);
    });
    it('draw: everyone joy', function () {
      var rng = A.core.Rng.mulberry32(7), found = null;
      for (var tries = 0; !found && tries < 20000; tries++) {
        var state = mk({});
        while (!state.result) {
          var m = randomMove(state, rng), nx = E.apply(state, m);
          if (nx.result && nx.result.type === 'draw') { found = { before: state, move: m, after: nx }; }
          state = nx;
        }
      }
      expect(!!found).toBe(true);
      var ev = R.detect(found.before, found.move, found.after, { endgameFired: true });
      expect(ev.length).toBe(2);
      expect(ev.every(function (e) { return e.kind === 'draw' && e.emotion === 'joy'; })).toBeTruthy();
    });
  });

  describe('drop4 reactions: mover never gets a bad face', function () {
    var BAD = { worried: 1, surprised: 1, anger: 1, sadness: 1 };
    function run(settings, games, seed) {
      var rng = A.core.Rng.mulberry32(seed), moves = 0;
      for (var g = 0; g < games; g++) {
        var s = mk(settings), fired = false;
        while (!s.result) {
          var m = randomMove(s, rng), after = E.apply(s, m);
          var ev = R.detect(s, m, after, { endgameFired: fired });
          if (of(ev, 'endgame').length) { fired = true; }
          ev.forEach(function (e) {
            if (e.by !== m.seat) { throw new Error('by mismatch'); }
            if (A.core.EmotionMap.LOGICAL.indexOf(e.emotion) < 0) { throw new Error('unknown emotion ' + e.emotion); }
            if (e.seat === m.seat && BAD[e.emotion]) { throw new Error('mover got ' + e.emotion + ' on ' + e.kind); }
          });
          s = after; moves++;
        }
      }
      return moves;
    }
    it('2 players with pop-out and blocks, 300 games', function () {
      expect(run({ players: 2, popOut: true, blocks: true }, 300, 11)).toBeGreaterThanOrEqual(300);
    });
    it('4 players team mode, 100 games', function () {
      expect(run({ players: 4, teams: true, popOut: true, blocks: true }, 100, 12)).toBeGreaterThanOrEqual(100);
    });
    it('3 players, 100 games', function () {
      expect(run({ players: 3 }, 100, 13)).toBeGreaterThanOrEqual(100);
    });
  });

  describe('drop4 reactions: PRIORITY', function () {
    it('matches the spec order', function () {
      expect(R.PRIORITY).toEqual(['win', 'lose', 'draw', 'double', 'block', 'reach', 'endgame', 'place']);
    });
  });
  describe('drop4/Reactions.vary', function () {
    var BAD = ['anger', 'sadness', 'panic', 'worried', 'surprised'];
    function ev(kind, seat, by, emotion) { return { kind: kind, seat: seat, by: by, emotion: emotion }; }
    function variety(v) { return A.core.EmotionVariety.create(function () { return v; }); }
    it('POOLS heads match detect', function () {
      var P = R.POOLS;
      expect([P.reach.mover[0], P.reach.other[0]]).toEqual(['joy', 'worried']);
      expect([P.double.mover[0], P.double.other[0]]).toEqual(['excited', 'surprised']);
      expect([P.block.mover[0], P.block.other[0]]).toEqual(['joy', 'anger']);
      expect(P.win.mover[0]).toBe('excited');
      expect(P.lose.other[0]).toBe('sadness');
      expect(P.lose.mover).toEqual(['normal']);
      expect(P.draw.mover[0]).toBe('joy');
      expect(P.endgame.mover).toEqual(['thinking']);
    });
    it('mover pools have no bad face', function () {
      Object.keys(R.POOLS).forEach(function (k) {
        R.POOLS[k].mover.forEach(function (e) { expect(BAD.indexOf(e) < 0).toBe(true); });
      });
    });
    it('varied emotion is in the pool and mover never gets a bad face', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var rng = A.core.Rng.mulberry32(21), vr = variety(v);
        for (var g = 0; g < 40; g++) {
          var s = mk({ players: 2, popOut: true, blocks: true }), fired = false;
          while (!s.result) {
            var m = randomMove(s, rng), after = E.apply(s, m);
            var raw = R.detect(s, m, after, { endgameFired: fired });
            if (of(raw, 'endgame').length) { fired = true; }
            var out = R.vary(raw, vr);
            out.forEach(function (e) {
              var pool = R.POOLS[e.kind][e.seat === e.by ? 'mover' : 'other'];
              expect(pool.indexOf(e.emotion) >= 0).toBe(true);
              if (e.seat === m.seat) { expect(BAD.indexOf(e.emotion) < 0).toBe(true); }
            });
            s = after;
          }
        }
      });
    });
    it('only the top event per seat is varied', function () {
      var out = R.vary([ev('reach', 1, 1, 'joy'), ev('block', 1, 1, 'joy')], variety(0.99));
      expect(out[0].emotion).toBe('joy');
      expect(out[1].emotion).toBe('smug');
    });
    it('does not mutate input', function () {
      var input = [ev('block', 1, 1, 'joy')];
      R.vary(input, variety(0.99));
      expect(input[0].emotion).toBe('joy');
    });
    it('lose other is sadness or worried', function () {
      [0, 0.99].forEach(function (v) {
        var out = R.vary([ev('win', 1, 1, 'excited'), ev('lose', 2, 1, 'sadness')], variety(v));
        expect(['sadness', 'worried'].indexOf(out[1].emotion) >= 0).toBe(true);
      });
      expect(R.vary([ev('lose', 2, 1, 'sadness')], variety(0.99))[0].emotion).toBe('worried');
    });
  });
})(window.Ailand);
