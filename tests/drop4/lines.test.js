(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Lines = A.games.drop4.Lines;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  var SITUATIONS = ['start', 'reach', 'reached', 'block', 'blocked', 'double', 'doubled',
    'endgame', 'win', 'lose', 'draw', 'thinking'];

  function othelloLines() {
    var set = {};
    var L = A.games.othello.Lines;
    Object.keys(L).forEach(function (id) {
      Object.keys(L[id]).forEach(function (k) {
        L[id][k].forEach(function (s) { set[s] = true; });
      });
    });
    return set;
  }

  describe('drop4/Lines', function () {
    it('defines 4 characters x 12 situations with 3+ lines', function () {
      CHARS.forEach(function (c) {
        expect(!!Lines[c]).toBe(true);
        SITUATIONS.forEach(function (s) {
          expect(Array.isArray(Lines[c][s]) && Lines[c][s].length >= 3).toBe(true);
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
    it('does not copy any othello line verbatim', function () {
      var o = othelloLines();
      CHARS.forEach(function (c) {
        SITUATIONS.forEach(function (s) {
          (Lines[c][s] || []).forEach(function (t) { expect(o[t]).toBe(undefined); });
        });
      });
    });
    it('has a thinking line with the 「うーん」 style', function () {
      CHARS.forEach(function (c) {
        expect(Lines[c].thinking.some(function (t) { return t.indexOf('うーん') === 0; })).toBe(true);
      });
    });
  });
})(window.Ailand);
