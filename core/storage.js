(function (C) {
  'use strict';

  var Storage = {
    // Replaceable in tests. Accessing window.localStorage itself may throw (blocked) or be absent (Node).
    get _backend() { return this._override !== undefined ? this._override : defaultBackend(); },
    set _backend(v) { this._override = v; },
    _override: undefined,

    // All keys are stored as 'ailand:<gameId>:<key>' (requirements 1.8).
    create: function (gameId) {
      var self = this;
      var prefix = 'ailand:' + gameId + ':';
      return {
        get: function (key, fallback) {
          try {
            var raw = self._backend.getItem(prefix + key);
            if (raw === null || raw === undefined) { return fallback; }
            var v = JSON.parse(raw);
            return v === undefined ? fallback : v;
          } catch (e) {
            return fallback;
          }
        },
        set: function (key, value) {
          try {
            var s = JSON.stringify(value);
            if (s === undefined) { return false; }
            self._backend.setItem(prefix + key, s);
            return true;
          } catch (e) {
            return false;
          }
        },
        remove: function (key) {
          try { self._backend.removeItem(prefix + key); } catch (e) { /* ignore */ }
        },
        has: function (key) {
          try {
            var raw = self._backend.getItem(prefix + key);
            return raw !== null && raw !== undefined;
          } catch (e) {
            return false;
          }
        }
      };
    }
  };

  function defaultBackend() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }

  C.Storage = Storage;
})(Ailand.core);
