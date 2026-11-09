(function (O) {
  'use strict';

  function memoryBackend() {
    var m = {};
    return {
      m: m,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  describe('runner', function () {
    it('runner works', function () { expect(1 + 1).toBe(2); });
  });

  describe('othello bus and store (core parts)', function () {
    it('O.bus is a core event bus: on/emit/off', function () {
      var got = [];
      var off = O.bus.on('test-x', function (p) { got.push(p); });
      O.bus.emit('test-x', 1);
      off();
      O.bus.emit('test-x', 2);
      expect(got).toEqual([1]);
    });
    it('O.store keeps the ailand:othello: keys', function () {
      var b = memoryBackend();
      Ailand.core.Storage._backend = b;
      try {
        expect(O.store.set(O.Const.SAVE_KEY, 1)).toBe(true);
        expect(b.m['ailand:othello:save.v1']).toBe('1');
        O.store.set(O.Const.SETTINGS_KEY, { mode: 'duo' });
        expect(b.m['ailand:othello:settings.v1']).toBe('{"mode":"duo"}');
      } finally { Ailand.core.Storage._backend = undefined; }
    });
  });
})(Ailand.games.othello);
