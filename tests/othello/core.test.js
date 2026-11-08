(function (O) {
  'use strict';

  function memoryBackend() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  describe('runner', function () {
    it('runner works', function () { expect(1 + 1).toBe(2); });
  });

  describe('bus', function () {
    it('on/emit delivers payload and off() stops delivery', function () {
      var bus = O.createBus();
      var got = [];
      var off = bus.on('x', function (p) { got.push(p); });
      bus.emit('x', 1);
      off();
      bus.emit('x', 2);
      expect(got).toEqual([1]);
    });
  });

  describe('Storage', function () {
    it('set then get returns the same value', function () {
      var original = O.Storage._backend;
      O.Storage._backend = memoryBackend();
      try {
        expect(O.Storage.set('k', { a: [1, 2] })).toBe(true);
        expect(O.Storage.get('k', null)).toEqual({ a: [1, 2] });
        O.Storage.remove('k');
        expect(O.Storage.get('k', 'fb')).toBe('fb');
      } finally { O.Storage._backend = original; }
    });
    it('throwing backend: get returns fallback, set returns false', function () {
      var original = O.Storage._backend;
      var boom = function () { throw new Error('denied'); };
      O.Storage._backend = { getItem: boom, setItem: boom, removeItem: boom };
      try {
        expect(O.Storage.get('k', 'fb')).toBe('fb');
        expect(O.Storage.set('k', 1)).toBe(false);
        O.Storage.remove('k');
      } finally { O.Storage._backend = original; }
    });
    it('broken JSON returns fallback', function () {
      var original = O.Storage._backend;
      var b = memoryBackend();
      b.setItem('k', '{broken');
      O.Storage._backend = b;
      try {
        expect(O.Storage.get('k', 'fb')).toBe('fb');
      } finally { O.Storage._backend = original; }
    });
  });
})(Ailand.games.othello);
