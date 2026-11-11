(function (A) {
  'use strict';
  // Wires the whack controller to real dependencies and starts the UI (sound, BGM and effects are driven by ui.js).
  var C = A.core, W = A.games.whack;

  function boot() {
    var bus = C.EventBus.create();
    var linePicker = C.LinePicker.create({ gameLines: W.Lines, commonLines: C.CommonLines, rng: Math.random });
    // Requirements 1.7: unlock at once when the browser allows audio, else on a gesture (core/sound.js wireUnlock).
    C.Sound.wireUnlock();
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) { C.Sound.play('button'); }
    }, true);
    var controller = W.Controller.create({
      bus: bus,
      storage: C.Storage.create('whack'),
      seed: function () { return Math.floor(Math.random() * 4294967296); }
    });
    var ui = null;
    // ui.js starts the loop only during countdown / play. onStep also moves the on-screen clock (ui.step).
    var loop = C.Loop.create({
      onStep: function (ms) { controller.advance(ms); if (ui) { ui.step(ms); } },
      onPause: function () { controller.pause('hidden'); if (ui) { ui.showPause('hidden'); } }
    });
    ui = W.UI.init(document.getElementById('app'), controller, { bus: bus, linePicker: linePicker, loop: loop });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.Ailand);
