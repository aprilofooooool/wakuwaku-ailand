(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Lines = A.games.blocks.Lines;
  var CHARS = ['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'];
  var MIN = { start: 3, mine: 5, multi: 3, almost: 3, clear: 3, over: 3, star: 3, timeup: 3, record: 3, nearRecord: 3 };
  var SITUATIONS = Object.keys(MIN);

  describe('blocks/Lines', function () {
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
      ['whack', 'othello', 'drop4'].forEach(function (g) {
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
    it('record lines never mention the goal or clearing', function () {
      CHARS.forEach(function (c) {
        ['record', 'nearRecord'].forEach(function (s) {
          Lines[c][s].forEach(function (t) {
            expect(t.indexOf('ゴール')).toBe(-1);
            expect(t.indexOf('クリア')).toBe(-1);
          });
        });
      });
    });
    it('keeps each voice', function () {
      var endings = { kuchipatchi: 'だっち', mimitchi: 'ぴょん' };
      Object.keys(endings).forEach(function (c) {
        SITUATIONS.forEach(function (s) {
          var ok = Lines[c][s].some(function (t) { return t.indexOf(endings[c]) >= 0; });
          expect(ok).toBe(true);
        });
      });
    });
  });
})(window.Ailand);
