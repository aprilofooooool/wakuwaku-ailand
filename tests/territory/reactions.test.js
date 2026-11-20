(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var G = A.games.territory, E = G.Engine, R = G.Reactions, K = G.Constants, Pieces = G.Pieces;
  var BAD = ['worried', 'surprised', 'anger', 'sadness', 'panic'];

  function of(events, kind) { return events.filter(function (e) { return e.kind === kind; }); }
  function seatsOf(events, kind) { return of(events, kind).map(function (e) { return e.seat; }).sort(); }
  function randomMove(state, rng) {
    var ms = E.legalMoves(state, state.turn);
    return ms[Math.floor(rng() * ms.length)];
  }
  // Plays random games; visit(before, move, after, ctx) returns true to stop.
  function scan(players, seeds, visit) {
    for (var seed = 1; seed <= seeds; seed++) {
      var rng = A.core.Rng.mulberry32(seed), s = E.create({ players: players, firstSeat: 1 });
      var ctx = { endgameFired: false };
      while (!E.isOver(s)) {
        var m = randomMove(s, rng), after = E.apply(s, m);
        if (visit(s, m, after, ctx)) { return true; }
        s = after;
      }
    }
    return false;
  }
  function lostAnchors(before, after, seat) {
    return E.anchors(before, seat).length - E.anchors(after, seat).length;
  }

  describe('territory reactions', function () {
    it('PRIORITY matches the spec order', function () {
      expect(R.PRIORITY).toEqual(['win', 'lose', 'draw', 'block', 'big', 'rest', 'endgame', 'place']);
    });

    it('a plain first move yields only place for the mover', function () {
      var s = E.create({ players: 2, firstSeat: 1 });
      var m = scanFirst(s);
      var ev = R.detect(s, m, E.apply(s, m), { endgameFired: false });
      expect(ev.length).toBe(1);
      expect(ev[0].kind).toBe('place');
      expect(ev[0].seat).toBe(1);
      expect(ev[0].by).toBe(1);
    });
    // First legal move whose piece is not five cells.
    function scanFirst(s) {
      return E.legalMoves(s, 1).filter(function (m) { return Pieces.byId(m.pieceId).cells.length < 5; })[0];
    }

    it('big is five cells', function () {
      var big = 0, small = 0;
      scan(2, 6, function (b, m, a) {
        if (E.isOver(a)) { return false; }
        var ev = R.detect(b, m, a, { endgameFired: true });
        var got = of(ev, 'big');
        if (Pieces.byId(m.pieceId).cells.length === 5) {
          big++;
          expect(got.length).toBe(1);
          expect(got[0].seat).toBe(m.seat);
          expect(got[0].emotion).toBe('joy');
        } else { small++; expect(got.length).toBe(0); }
        return false;
      });
      expect(big > 0).toBe(true);
      expect(small > 0).toBe(true);
    });

    it('block needs three anchors lost', function () {
      var lost2 = 0, lost3 = 0;
      scan(4, 12, function (b, m, a) {
        if (E.isOver(a)) { return false; }
        var ev = R.detect(b, m, a, { endgameFired: true });
        var blocked = [];
        for (var s = 1; s <= 4; s++) {
          if (s === m.seat || b.resting[s]) { continue; }
          var n = lostAnchors(b, a, s);
          if (n >= K.BLOCK_MIN) { blocked.push(s); lost3++; }
          if (n === 2) { lost2++; }
        }
        var evSeats = of(ev, 'block').filter(function (e) { return e.seat !== m.seat; }).map(function (e) { return e.seat; });
        expect(evSeats).toEqual(blocked);
        if (blocked.length) {
          var mine = of(ev, 'block').filter(function (e) { return e.seat === m.seat; });
          expect(mine.length).toBe(1);
          expect(mine[0].emotion).toBe('joy');
          expect(mine[0].others).toEqual(blocked);
          expect(of(ev, 'block').filter(function (e) { return e.seat === blocked[0]; })[0].emotion).toBe('surprised');
        }
        return false;
      });
      expect(lost2 > 0).toBe(true);
      expect(lost3 > 0).toBe(true);
    });

    it('rest comes from justRested', function () {
      var found = scan(3, 60, function (b, m, a) {
        var others = a.justRested.filter(function (s) { return s !== m.seat; });
        if (!others.length || E.isOver(a)) { return false; }
        var ev = R.detect(b, m, a, { endgameFired: true });
        expect(seatsOf(ev, 'rest')).toEqual(others.slice().sort());
        of(ev, 'rest').forEach(function (e) { expect(e.emotion).toBe('worried'); expect(e.by).toBe(m.seat); });
        return true;
      });
      expect(found).toBe(true);
    });

    it('mover resting on its own move gets no rest face', function () {
      var found = scan(2, 200, function (b, m, a) {
        if (E.isOver(a) || a.justRested.indexOf(m.seat) < 0) { return false; }
        var ev = R.detect(b, m, a, { endgameFired: true });
        expect(of(ev, 'rest').filter(function (e) { return e.seat === m.seat; }).length).toBe(0);
        return true;
      });
      expect(found).toBe(true);
    });

    it('endgame fires once, for everyone, at a quarter of the cells or the first rest', function () {
      var initial = 2 * Pieces.TOTAL_CELLS, count = 0;
      scan(2, 1, function (b, m, a, ctx) {
        var ev = R.detect(b, m, a, ctx);
        var eg = of(ev, 'endgame');
        if (eg.length) {
          count++;
          expect(eg.length).toBe(2);
          expect(eg[0].emotion).toBe('thinking');
          expect(ctx.endgameFired).toBe(true);
          expect(E.remainingCells(a) * 4 <= initial || a.justRested.length > 0).toBe(true);
        } else if (!E.isOver(a) && !ctx.endgameFired) {
          expect(E.remainingCells(a) * 4 > initial).toBe(true);
          expect(a.justRested.length).toBe(0);
        }
        return false;
      });
      expect(count).toBe(1);
    });

    it('endgame does not fire when ctx.endgameFired is set', function () {
      scan(2, 2, function (b, m, a) {
        expect(of(R.detect(b, m, a, { endgameFired: true }), 'endgame').length).toBe(0);
        return false;
      });
    });

    it('win and lose at the end; a losing mover gets a neutral face', function () {
      var seen = false;
      scan(2, 5, function (b, m, a) {
        if (!E.isOver(a)) { return false; }
        var res = E.result(a), ev = R.detect(b, m, a, { endgameFired: true });
        expect(ev.length).toBe(2);
        for (var s = 1; s <= 2; s++) {
          var e = ev.filter(function (x) { return x.seat === s; })[0];
          var win = res.winners.indexOf(s) >= 0;
          expect(e.kind).toBe(win ? (res.draw ? 'draw' : 'win') : 'lose');
          if (e.kind === 'win') { expect(e.emotion).toBe('excited'); }
          if (e.kind === 'lose') { expect(e.emotion).toBe(s === m.seat ? 'normal' : 'sadness'); }
        }
        seen = true;
        return false;
      });
      expect(seen).toBe(true);
    });

    it('draw gives every winner a draw face and the rest lose', function () {
      var s = E.create({ players: 3, firstSeat: 1 });
      var after = JSON.parse(JSON.stringify(s));
      after.turn = null;
      after.placed = { 1: 10, 2: 10, 3: 7 };
      var ev = R.detect(s, { seat: 3, pieceId: 'I1', rot: 0, flip: 0, x: 0, y: 0 }, after, { endgameFired: true });
      expect(seatsOf(ev, 'draw')).toEqual([1, 2]);
      expect(seatsOf(ev, 'lose')).toEqual([3]);
      expect(of(ev, 'draw')[0].emotion).toBe('joy');
    });

    it('priority picks one', function () {
      var ev = [{ kind: 'place', seat: 1, by: 1, emotion: 'normal' }, { kind: 'big', seat: 1, by: 1, emotion: 'joy' },
        { kind: 'block', seat: 1, by: 1, emotion: 'joy' }];
      var picked = A.core.Reaction.pick(ev, { humans: [1], mover: 1, priority: R.PRIORITY });
      expect(picked.event.kind).toBe('block');
    });

    it('mover never gets a bad face', function () {
      var variety = A.core.EmotionVariety.create(A.core.Rng.mulberry32(5));
      [2, 4].forEach(function (players) {
        scan(players, players === 2 ? 30 : 3, function (b, m, a, ctx) {
          var ev = R.detect(b, m, a, ctx);
          R.vary(ev, variety).concat(ev).forEach(function (e) {
            expect(e.by).toBe(m.seat);
            expect(A.core.EmotionMap.LOGICAL.indexOf(e.emotion) >= 0).toBe(true);
            if (e.seat === m.seat) { expect(BAD.indexOf(e.emotion) < 0).toBe(true); }
          });
          return false;
        });
      });
    });

    it('POOLS heads match detect and mover pools have no bad face', function () {
      var P = R.POOLS;
      expect([P.big.mover[0], P.block.mover[0], P.block.other[0], P.rest.other[0]]).toEqual(['joy', 'joy', 'surprised', 'worried']);
      expect([P.win.mover[0], P.lose.other[0], P.draw.mover[0], P.endgame.mover[0]]).toEqual(['excited', 'sadness', 'joy', 'thinking']);
      Object.keys(P).forEach(function (k) {
        P[k].mover.forEach(function (e) { expect(BAD.indexOf(e) < 0).toBe(true); });
      });
    });

    it('same face not three times', function () {
      var v = A.core.EmotionVariety.create(function () { return 0; });
      var run = [];
      for (var i = 0; i < 6; i++) {
        run.push(R.vary([{ kind: 'block', seat: 1, by: 1, emotion: 'joy' }], v)[0].emotion);
      }
      for (var j = 2; j < run.length; j++) {
        expect(run[j] === run[j - 1] && run[j] === run[j - 2]).toBe(false);
      }
    });

    it('vary changes only the top event per seat and keeps the input', function () {
      var v = A.core.EmotionVariety.create(function () { return 0.99; });
      var input = [{ kind: 'big', seat: 1, by: 1, emotion: 'joy' }, { kind: 'block', seat: 1, by: 1, emotion: 'joy' }];
      var out = R.vary(input, v);
      expect(out[0].emotion).toBe('joy');
      expect(out[1].emotion).toBe('smug');
      expect(input[1].emotion).toBe('joy');
    });
  });
})(window.Ailand);
