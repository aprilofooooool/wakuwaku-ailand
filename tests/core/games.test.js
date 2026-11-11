(function () {
  'use strict';
  var G = Ailand.core.Games;

  function backend(keys) {
    return { getItem: function (k) { return keys.indexOf(k) >= 0 ? '{}' : null; } };
  }

  describe('core/Games', function () {
    it('lists 7 games, 3 of them ready', function () {
      expect(G.LIST.length).toBe(7);
      expect(G.LIST.filter(function (g) { return g.ready; }).length).toBe(3);
    });
    it('whack is ready at games/whack/index.html without a save key', function () {
      var w = G.LIST.filter(function (g) { return g.id === 'whack'; })[0];
      expect(w.ready).toBe(true);
      expect(w.href).toBe('games/whack/index.html');
      expect(w.saveKey).toBe(null);
    });
    it('ids are lowercase alphanumeric with hyphens and unique', function () {
      var seen = {};
      G.LIST.forEach(function (g) {
        expect(/^[a-z0-9-]+$/.test(g.id)).toBe(true);
        expect(seen[g.id]).toBe(undefined);
        seen[g.id] = true;
      });
    });
    it('hasSave is true only when the backend has the save key', function () {
      var drop4 = G.LIST[0];
      var othello = G.LIST[1];
      expect(drop4.id).toBe('drop4');
      expect(othello.id).toBe('othello');
      expect(G.hasSave(drop4, backend([]))).toBe(false);
      expect(G.hasSave(drop4, backend(['ailand:drop4:save.v1']))).toBe(true);
      expect(G.hasSave(othello, backend(['ailand:drop4:save.v1']))).toBe(false);
      expect(G.hasSave(othello, backend(['ailand:othello:save.v1']))).toBe(true);
    });
    it('hasSave is always false for not-ready games and for a missing backend', function () {
      var all = backend(G.LIST.map(function (g) { return 'ailand:' + g.id + ':save.v1'; }));
      G.LIST.filter(function (g) { return !g.ready; }).forEach(function (g) {
        expect(G.hasSave(g, all)).toBe(false);
      });
      expect(G.hasSave(G.LIST[0], null)).toBe(false);
    });
  });
})();
