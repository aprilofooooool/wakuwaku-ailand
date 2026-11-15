(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Lines = A.games.chain.Lines;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  var MIN = { start: 3, wake: 5, chain: 3, almost: 3, turn: 3, clear: 3, record: 3, over: 3, timeup: 3 };
  var SITUATIONS = Object.keys(MIN);

  describe('chain/Lines', function () {
    it('every character has every situation with enough lines', function () {
      CHARS.forEach(function (c) {
        expect(!!Lines[c]).toBe(true);
        SITUATIONS.forEach(function (s) {
          expect(Array.isArray(Lines[c][s]) && Lines[c][s].length >= MIN[s]).toBe(true);
        });
      });
    });
    it('lines are 20 characters or shorter, non-blank, unique per character', function () {
      CHARS.forEach(function (c) {
        var seen = {};
        SITUATIONS.forEach(function (s) {
          Lines[c][s].forEach(function (t) {
            var n = Array.from(t).length;
            expect(typeof t === 'string' && n >= 1 && n <= 20).toBe(true);
            expect(t.trim().length > 0).toBe(true);
            expect(seen[t]).toBe(undefined);
            seen[t] = true;
          });
        });
      });
    });
    it('does not copy a line of another game verbatim', function () {
      ['blocks', 'whack', 'othello', 'drop4'].forEach(function (g) {
        var L = A.games[g].Lines;
        Object.keys(L).forEach(function (id) {
          Object.keys(L[id]).forEach(function (k) {
            L[id][k].forEach(function (t) {
              CHARS.forEach(function (c) {
                SITUATIONS.forEach(function (s) { expect(Lines[c][s].indexOf(t)).toBe(-1); });
              });
            });
          });
        });
      });
    });
    it('keeps each voice', function () {
      var endings = { kuchipatchi: 'だっち', mimitchi: 'ぴょん' };
      Object.keys(endings).forEach(function (c) {
        SITUATIONS.forEach(function (s) {
          expect(Lines[c][s].some(function (t) { return t.indexOf(endings[c]) >= 0; })).toBe(true);
        });
      });
    });
  });
})(window.Ailand);
