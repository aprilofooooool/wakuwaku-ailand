(function (O) {
  'use strict';
  var F = O.FaceVariety;
  function fixed(v) { return function () { return v; }; }

  describe('othello/FaceVariety (B-3)', function () {
    it('during maps by name', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var f = F.create(fixed(v));
        expect(['joy', 'excited', 'cheer'].indexOf(f.during('p1', 'joy')) >= 0).toBe(true);
        expect(['panic', 'surprised', 'worried'].indexOf(f.during('p1', 'panic')) >= 0).toBe(true);
        expect(['sadness', 'worried'].indexOf(f.during('p1', 'sadness')) >= 0).toBe(true);
        expect(f.during('p2', 'anger')).toBe('anger');
        expect(f.during('p2', 'normal')).toBe('normal');
        expect(f.during('p2', 'thinking')).toBe('thinking');
      });
      expect(F.create(fixed(0.99)).during('p1', 'joy')).toBe('cheer');
    });
    it('final pools', function () {
      [0, 0.5, 0.99].forEach(function (v) {
        var f = F.create(fixed(v));
        expect(['excited', 'cheer', 'love'].indexOf(f.final('p1', 'win')) >= 0).toBe(true);
        expect(['sadness', 'worried'].indexOf(f.final('p2', 'lose')) >= 0).toBe(true);
      });
      expect(F.create(fixed(0.99)).final('p2', 'lose')).toBe('worried');
    });
    it('no three in a row', function () {
      var f = F.create(fixed(0)), seq = [], i;
      for (i = 0; i < 10; i++) { seq.push(f.during('p1', 'joy')); }
      for (i = 2; i < seq.length; i++) {
        expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
      }
    });
  });
})(Ailand.games.othello);
