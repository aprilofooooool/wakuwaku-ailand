(function (A) {
  'use strict';
  // Wires the drop4 controller to real dependencies and starts the UI (sound, BGM and effects are driven by ui.js).
  var C = A.core, D = A.games.drop4;

  function boot() {
    var bus = C.EventBus.create();
    var rng = Math.random;
    var linePicker = C.LinePicker.create({ gameLines: D.Lines, commonLines: C.CommonLines, rng: rng });
    // Requirements 1.7: unlock at once when the browser allows audio, else on a gesture (core/sound.js wireUnlock).
    // BGM started earlier stays silent until then.
    C.Sound.wireUnlock();
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) { C.Sound.play('button'); }
    }, true);
    var controller = D.Controller.create({
      bus: bus,
      rng: rng,
      scheduler: function (fn, ms) { setTimeout(fn, ms || 0); },
      storage: C.Storage.create('drop4'),
      ai: D.Ai,
      now: function () { return performance.now(); },
      linePicker: linePicker
    });
    D.UI.init(document.getElementById('app'), controller, { bus: bus, rng: rng, linePicker: linePicker });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.Ailand);
