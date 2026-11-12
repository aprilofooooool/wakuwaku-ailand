(function (C) {
  'use strict';

  // Tells when nobody has operated for `ms` (the "falls asleep while waiting" reaction).
  // States: off -> arm() -> counting -> (ms) -> asleep -> poke() -> done (sleeps once per turn).
  // opts: { ms, onIdle(), onWake(), timers?: { setTimeout, clearTimeout } }
  function create(opts) {
    var timers = opts.timers || { setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (id) { clearTimeout(id); } };
    var st = 'off', id = null;

    function clear() { if (id !== null) { timers.clearTimeout(id); id = null; } }
    function count() {
      clear();
      st = 'counting';
      id = timers.setTimeout(function () { id = null; st = 'asleep'; opts.onIdle(); }, opts.ms);
    }

    return {
      arm: function () { count(); },
      poke: function () {
        if (st === 'counting') { count(); }
        else if (st === 'asleep') { st = 'done'; opts.onWake(); }
      },
      pause: function () { if (st === 'counting') { clear(); st = 'paused'; } },
      resume: function () { if (st === 'paused') { count(); } },
      stop: function () {
        clear();
        var wasAsleep = st === 'asleep';
        st = 'off';
        if (wasAsleep) { opts.onWake(); }
      },
      state: function () { return st; }
    };
  }

  C.IdleTimer = { create: create };
})(Ailand.core);
