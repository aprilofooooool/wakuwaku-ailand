(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Lines = A.games.whack.Lines;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  var MIN = { hit: 5, rare: 3, smug: 3, start: 3, record: 3, win: 3, lose: 3, draw: 3, end: 3, combo: 3 };
  var SITUATIONS = Object.keys(MIN);

  function collect(L) {
    var set = {};
    Object.keys(L).forEach(function (id) {
      Object.keys(L[id]).forEach(function (k) {
        L[id][k].forEach(function (s) { set[s] = true; });
      });
    });
    return set;
  }

  describe('whack/Lines', function () {
    it('defines 4 characters x 10 situations with the minimum count', function () {
      CHARS.forEach(function (c) {
        expect(!!Lines[c]).toBe(true);
        SITUATIONS.forEach(function (s) {
          expect(Array.isArray(Lines[c][s]) && Lines[c][s].length >= MIN[s]).toBe(true);
        });
      });
    });
    it('keeps every line 1-20 chars, non-blank, unique per character', function () {
      CHARS.forEach(function (c) {
        var seen = {};
        SITUATIONS.forEach(function (s) {
          (Lines[c][s] || []).forEach(function (t) {
            var n = Array.from(t).length;
            expect(typeof t === 'string' && n >= 1 && n <= 20).toBe(true);
            expect(t.trim().length > 0).toBe(true);
            expect(seen[t]).toBe(undefined);
            seen[t] = true;
          });
        });
      });
    });
    it('does not copy any othello or drop4 line verbatim', function () {
      var o = collect(A.games.othello.Lines), d = collect(A.games.drop4.Lines);
      CHARS.forEach(function (c) {
        SITUATIONS.forEach(function (s) {
          (Lines[c][s] || []).forEach(function (t) {
            expect(o[t]).toBe(undefined);
            expect(d[t]).toBe(undefined);
          });
        });
      });
    });
  });
})(window.Ailand);
