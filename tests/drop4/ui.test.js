(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var UI = A.games.drop4.UI;

  function two(h1, h2, choice) {
    return { players: 2, teams: false, popOut: false, blocks: false, level: 'weak', firstChoice: choice,
      seats: [{ seat: 1, charId: 'mametchi', human: h1 }, { seat: 2, charId: 'kuchipatchi', human: h2 }] };
  }
  function rng() { return 0; }

  describe('drop4 UI: withFirstSeat (2 players)', function () {
    it('じぶん is the human seat: seat 1 when 1P is human', function () {
      expect(UI.withFirstSeat(two(true, false, 'me'), rng).firstSeat).toBe(1);
      expect(UI.withFirstSeat(two(true, false, 'them'), rng).firstSeat).toBe(2);
    });
    it('じぶん is seat 2 when only 2P is human', function () {
      expect(UI.withFirstSeat(two(false, true, 'me'), rng).firstSeat).toBe(2);
      expect(UI.withFirstSeat(two(false, true, 'them'), rng).firstSeat).toBe(1);
    });
    it('both CPU falls back to seat 1', function () {
      expect(UI.withFirstSeat(two(false, false, 'me'), rng).firstSeat).toBe(1);
      expect(UI.withFirstSeat(two(false, false, 'them'), rng).firstSeat).toBe(2);
    });
  });
})(window.Ailand);
