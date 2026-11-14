(function (C) {
  'use strict';
  // Game catalog for the entry page. saveKey is the full localStorage key (requirements 1.8).

  var LIST = [
    { id: 'drop4', name: 'ぽとん4', href: 'games/drop4/index.html', ready: true, saveKey: 'ailand:drop4:save.v1' },
    { id: 'othello', name: 'オセロっち', href: 'games/othello/index.html', ready: true, saveKey: 'ailand:othello:save.v1' },
    { id: 'whack', name: 'キャラたたき', href: 'games/whack/index.html', ready: true, saveKey: null },
    { id: 'fill', name: 'ピースうめ', href: '', ready: false, saveKey: null },
    { id: 'territory', name: 'ピースじんとり', href: '', ready: false, saveKey: null },
    { id: 'blocks', name: 'おちブロック', href: 'games/blocks/index.html', ready: true, saveKey: null },
    { id: 'chain', name: 'おちものれんさ', href: '', ready: false, saveKey: null }
  ];

  // backend: object with getItem (or null). Never throws.
  function hasSave(game, backend) {
    if (!game || !game.ready || !game.saveKey || !backend) { return false; }
    try {
      var v = backend.getItem(game.saveKey);
      return v !== null && v !== undefined;
    } catch (e) {
      return false;
    }
  }

  C.Games = { LIST: LIST, hasSave: hasSave };
})(window.Ailand.core);
