(function (O) {
  'use strict';

  describe('UI settings', function () {
    it('old settings with sound:false still load', function () {
      var r = O.UI._normalizeSettings({ sound: false, mode: 'duo', boardSize: 6 });
      expect(r.mode).toBe('duo');
      expect(r.boardSize).toBe(6);
      expect('sound' in r).toBe(false);
    });
  });
})(Ailand.games.othello);
