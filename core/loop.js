(function (C) {
  'use strict';

  // Fixed-interval loop: calls onStep(STEP_MS) in 1/60 s slices from requestAnimationFrame.
  // raf / caf / now / doc are injectable (tests run without a browser); defaults are resolved lazily.
  var STEP_MS = 1000 / 60;
  var MAX_STEPS = 5; // per frame; the rest of the backlog is dropped

  function create(opts) {
    var o = opts || {};
    var raf = o.raf || function (cb) { return window.requestAnimationFrame(cb); };
    var caf = o.caf || function (id) { window.cancelAnimationFrame(id); };
    var now = o.now || function () { return performance.now(); };
    var doc = o.doc || (typeof document !== 'undefined' ? document : null);
    var running = false;
    var rafId = null;
    var last = 0;
    var acc = 0;

    function frame() {
      if (!running) { return; }
      var t = now();
      acc += t - last;
      last = t;
      var n = Math.floor(acc / STEP_MS);
      if (n > MAX_STEPS) { n = MAX_STEPS; acc = 0; } else { acc -= n * STEP_MS; }
      for (var i = 0; i < n && running; i++) { o.onStep(STEP_MS); }
      if (running) { rafId = raf(frame); }
    }

    function start() {
      if (running) { return; }
      running = true;
      last = now();
      acc = 0;
      rafId = raf(frame);
    }

    function stop() {
      if (!running) { return; }
      running = false;
      if (rafId !== null) { caf(rafId); rafId = null; }
    }

    if (doc) {
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden && running) {
          stop();
          if (o.onPause) { o.onPause(); }
        }
      });
    }

    return { start: start, stop: stop, isRunning: function () { return running; } };
  }

  C.Loop = { create: create, STEP_MS: STEP_MS, MAX_STEPS: MAX_STEPS };
})(Ailand.core);
