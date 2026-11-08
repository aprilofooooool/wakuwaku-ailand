(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var E = A.games.drop4.Engine;

  function mk(o) {
    var s = { players: 2, teams: false, popOut: false, blocks: false, firstSeat: 1 };
    for (var k in o) { s[k] = o[k]; }
    return E.create(s);
  }
  // Place pieces directly: stacks maps column -> array of seats bottom-up. turnIndex picks the mover.
  function setup(state, stacks, turnIndex) {
    for (var c in stacks) {
      stacks[c].forEach(function (v, r) { state.cells[Number(c) * state.rows + r] = v; });
    }
    state.turnIndex = turnIndex || 0;
    return state;
  }
  function pop(state, col) { return E.apply(state, { type: 'pop', col: col, seat: E.currentSeat(state) }); }
  function drop(state, col) { return E.apply(state, { type: 'drop', col: col, seat: E.currentSeat(state) }); }
  function types(state) {
    return E.legalMoves(state).filter(function (m) { return m.type === 'pop'; }).map(function (m) { return m.col; });
  }

  describe('drop4 engine: popOut moves', function () {
    it('no pop when popOut is off', function () {
      var s = setup(mk({}), { 0: [1] });
      expect(types(s)).toEqual([]);
      expect(function () { pop(s, 0); }).toThrow();
    });
    it('pop only on columns whose bottom is own colour', function () {
      var s = setup(mk({ popOut: true }), { 0: [1], 1: [2], 2: [9], 3: [1, 2] });
      expect(types(s)).toEqual([0, 3]);
    });
    it('teammate bottom piece cannot be popped', function () {
      var s = setup(mk({ players: 4, teams: true, popOut: true }), { 0: [3], 1: [1], 2: [2] });
      expect(types(s)).toEqual([1]);
    });
    it('pop lowers the column by one and empties the top', function () {
      var s = setup(mk({ popOut: true }), { 0: [1, 2, 1] });
      var n = pop(s, 0);
      expect([E.at(n, 0, 0), E.at(n, 0, 1), E.at(n, 0, 2)]).toEqual([2, 1, 0]);
      expect(s.cells[0]).toBe(1);
      expect(n.moveCount).toBe(1);
      expect(n.lastMove).toEqual({ type: 'pop', col: 0, seat: 1 });
      expect(E.currentSeat(n)).toBe(2);
    });
  });

  describe('drop4 engine: pop results', function () {
    it('popper alone completes a line', function () {
      var s = setup(mk({ popOut: true }), { 0: [1, 2, 1], 1: [2, 1], 2: [1, 1], 3: [2, 1] });
      var n = pop(s, 0);
      expect(n.result.type).toBe('win');
      expect(n.result.seats).toEqual([1]);
    });
    it('popper and opponent both complete: popper wins', function () {
      var s = setup(mk({ popOut: true }), { 0: [1, 2, 1], 1: [2, 1], 2: [2, 1], 3: [2, 1] });
      var n = pop(s, 0);
      expect(n.result.type).toBe('win');
      expect(n.result.seats).toEqual([1]);
      expect(n.result.team).toBe(null);
    });
    it('only the opponent completes: opponent wins', function () {
      var s = setup(mk({ popOut: true }), { 0: [1, 2], 1: [2], 2: [2], 3: [2] });
      var n = pop(s, 0);
      expect(n.result.type).toBe('win');
      expect(n.result.seats).toEqual([2]);
    });
    it('3 players, two non-poppers complete: next seat after popper wins', function () {
      var s = setup(mk({ players: 3, popOut: true }), { 0: [1, 2, 3], 1: [2, 3], 2: [2, 3], 3: [2, 3] });
      var n = pop(s, 0);
      expect(n.result.seats).toEqual([2]);
    });
    it('turn order decides: popper seat 3 in order [2,3,1] hands the win to seat 1', function () {
      var s = setup(mk({ players: 3, popOut: true, firstSeat: 2 }), { 0: [3, 1, 2], 1: [1, 2], 2: [1, 2], 3: [1, 2] }, 1);
      expect(E.currentSeat(s)).toBe(3);
      var n = pop(s, 0);
      expect(n.result.seats).toEqual([1]);
    });
    it('team mode: popper team wins over the other team, seats mix', function () {
      var s = setup(mk({ players: 4, teams: true, popOut: true }), { 0: [1, 4, 3], 1: [2, 1], 2: [2, 1], 3: [2, 1] });
      var n = pop(s, 0);
      expect(n.result.type).toBe('win');
      expect(n.result.team).toBe(0);
      expect(n.result.seats).toEqual([1, 3]);
    });
    it('team mode: only the other team completes', function () {
      var s = setup(mk({ players: 4, teams: true, popOut: true }), { 0: [1, 4], 1: [2], 2: [2], 3: [2] });
      var n = pop(s, 0);
      expect(n.result.team).toBe(1);
      expect(n.result.seats).toEqual([2, 4]);
    });
    it('full board is still a draw with popOut on', function () {
      var seq = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6];
      var s = mk({ popOut: true });
      seq.forEach(function (c) { s = drop(s, c); });
      expect(s.result).toEqual({ type: 'draw', reason: 'full' });
    });
    it('draw by move limit after 84 drop/pop moves (2 players 7x6)', function () {
      var s = mk({ popOut: true });
      var cycle = [['drop', 0], ['drop', 1], ['pop', 0], ['pop', 1]];
      for (var i = 0; i < 84; i++) {
        expect(s.result).toBe(null);
        var m = cycle[i % 4];
        s = E.apply(s, { type: m[0], col: m[1], seat: E.currentSeat(s) });
      }
      expect(s.moveCount).toBe(84);
      expect(s.result).toEqual({ type: 'draw', reason: 'limit' });
    });
  });

  describe('drop4 engine: blocks', function () {
    it('each seat starts with 2 and block lowers only the mover count', function () {
      var s = mk({ blocks: true });
      expect(s.blocksLeft).toEqual({ 1: 2, 2: 2 });
      var n = E.apply(s, { type: 'block', col: 3, seat: 1 });
      expect(E.at(n, 3, 0)).toBe(9);
      expect(n.blocksLeft).toEqual({ 1: 1, 2: 2 });
      expect(s.blocksLeft).toEqual({ 1: 2, 2: 2 });
      expect(n.lastMove).toEqual({ type: 'block', col: 3, seat: 1 });
    });
    it('block moves are listed until the stock is 0', function () {
      var s = mk({ blocks: true });
      var count = function (st) { return E.legalMoves(st).filter(function (m) { return m.type === 'block'; }).length; };
      expect(count(s)).toBe(7);
      s = E.apply(s, { type: 'block', col: 0, seat: 1 });
      s = drop(s, 6);
      s = E.apply(s, { type: 'block', col: 1, seat: 1 });
      expect(s.blocksLeft[1]).toBe(0);
      s = drop(s, 6);
      expect(count(s)).toBe(0);
      expect(function () { E.apply(s, { type: 'block', col: 2, seat: 1 }); }).toThrow();
    });
    it('no block moves without the blocks option', function () {
      var s = mk({});
      expect(E.legalMoves(s).some(function (m) { return m.type === 'block'; })).toBe(false);
    });
    it('a block between pieces does not make a five-cell win', function () {
      // seat 1 at cols 0,1,3,4 on the bottom row with a block at col 2.
      var s = setup(mk({ blocks: true }), { 0: [1], 1: [1], 2: [9], 3: [1] });
      var n = drop(s, 4);
      expect(n.result).toBe(null);
    });
    it('a block cannot be popped', function () {
      var s = setup(mk({ popOut: true, blocks: true }), { 0: [9], 1: [1] });
      expect(types(s)).toEqual([1]);
    });
  });
})(window.Ailand);
