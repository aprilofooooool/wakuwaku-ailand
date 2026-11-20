(function (A) {
  'use strict';
  // Wires the territory controller to real dependencies and starts the UI (sound and BGM are driven by ui.js).
  var C = A.core, G = A.games.territory;

  function boot() {
    var bus = C.EventBus.create();
    var rng = Math.random;
    var linePicker = C.LinePicker.create({ gameLines: G.Lines, commonLines: C.CommonLines, rng: rng });
    // Requirements 1.7: unlock at once when the browser allows audio, else on a gesture (core/sound.js wireUnlock).
    C.Sound.wireUnlock();
    // まわす and うらがえす have their own sounds, so they skip the click tone.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b && !b.closest('.tr-acts')) { C.Sound.play('button'); }
    }, true);
    var controller = G.Controller.create({
      bus: bus,
      rng: rng,
      storage: C.Storage.create('territory'),
      ai: G.Ai,
      now: function () { return performance.now(); },
      linePicker: linePicker
    });
    G.UI.init(document.getElementById('app'), controller, { bus: bus, linePicker: linePicker });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.Ailand);
