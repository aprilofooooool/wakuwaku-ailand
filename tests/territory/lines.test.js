(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Lines = A.games.territory.Lines;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  var SITUATIONS = ['start', 'big', 'block', 'blocked', 'rest', 'endgame', 'win', 'lose', 'draw', 'thinking'];

  function otherGameLines() {
    var set = {};
    ['othello', 'drop4'].forEach(function (g) {
      var L = A.games[g].Lines;
      Object.keys(L).forEach(function (id) {
        Object.keys(L[id]).forEach(function (k) { L[id][k].forEach(function (s) { set[s] = true; }); });
      });
    });
    return set;
  }

  describe('territory/Lines', function () {
    it('every char has three lines per situation within 20 chars', function () {
      CHARS.forEach(function (c) {
        expect(!!Lines[c]).toBe(true);
        SITUATIONS.forEach(function (s) {
          expect(Array.isArray(Lines[c][s]) && Lines[c][s].length >= 3).toBe(true);
          Lines[c][s].forEach(function (t) {
            var n = Array.from(t).length;
            expect(typeof t === 'string' && n >= 1 && n <= 20).toBe(true);
          });
        });
      });
    });
    it('is unique per character and copies no othello or drop4 line', function () {
      var o = otherGameLines();
      CHARS.forEach(function (c) {
        var seen = {};
        SITUATIONS.forEach(function (s) {
          Lines[c][s].forEach(function (t) {
            expect(seen[t]).toBe(undefined);
            seen[t] = true;
            expect(o[t]).toBe(undefined);
          });
        });
      });
    });
    it('thinking lines start with うーん', function () {
      CHARS.forEach(function (c) {
        expect(Lines[c].thinking.every(function (t) { return t.indexOf('うーん') === 0; })).toBe(true);
      });
    });
    it('speaks with each character voice', function () {
      var by = {};
      A.core.Characters.list().forEach(function (c) { by[c.id] = c.voice; });
      CHARS.forEach(function (c) {
        var all = [];
        SITUATIONS.forEach(function (s) { all = all.concat(Lines[c][s]); });
        if (by[c].ending) {
          expect(all.filter(function (t) { return t.indexOf(by[c].ending) >= 0; }).length * 2 > all.length).toBe(true);
        }
        expect(all.some(function (t) { return t.indexOf(by[c].firstPerson) >= 0; })).toBe(true);
      });
    });
  });
})(window.Ailand);
