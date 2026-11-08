(function () {
  'use strict';
  var S = Ailand.core.Storage;

  function memory() {
    var m = {};
    return {
      m: m,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  describe('core/Storage', function () {
    it('prefixes keys with ailand:<gameId>:', function () {
      var b = memory();
      S._backend = b;
      try {
        var st = S.create('drop4');
        expect(st.set('save.v1', { a: 1 })).toBe(true);
        expect(b.m['ailand:drop4:save.v1']).toBe('{"a":1}');
        expect(st.get('save.v1', null)).toEqual({ a: 1 });
        expect(st.has('save.v1')).toBe(true);
        st.remove('save.v1');
        expect(st.has('save.v1')).toBe(false);
      } finally { S._backend = undefined; }
    });
    it('get returns fallback when unset or JSON is invalid', function () {
      var b = memory();
      S._backend = b;
      try {
        var st = S.create('drop4');
        expect(st.get('x', 5)).toBe(5);
        b.m['ailand:drop4:bad'] = '{oops';
        expect(st.get('bad', 'fb')).toBe('fb');
      } finally { S._backend = undefined; }
    });
    it('set returns false and does not throw when setItem throws', function () {
      S._backend = {
        getItem: function () { return null; },
        setItem: function () { throw new Error('quota'); },
        removeItem: function () {}
      };
      try {
        expect(S.create('drop4').set('k', 1)).toBe(false);
      } finally { S._backend = undefined; }
    });
    it('works without any backend (null)', function () {
      S._backend = null;
      try {
        var st = S.create('drop4');
        expect(st.get('k', 7)).toBe(7);
        expect(st.set('k', 1)).toBe(false);
        expect(st.has('k')).toBe(false);
        st.remove('k');
      } finally { S._backend = undefined; }
    });
    it('writes only ailand: keys', function () {
      var b = memory();
      S._backend = b;
      try {
        S.create('core').set('settings', 1);
        expect(Object.keys(b.m)).toEqual(['ailand:core:settings']);
      } finally { S._backend = undefined; }
    });
  });
})();
