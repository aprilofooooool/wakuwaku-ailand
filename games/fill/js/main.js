(function (A) {
  'use strict';
  // Wires the fill controller to real dependencies and starts the UI (sound and BGM are driven by ui.js).
  var C = A.core, G = A.games.fill;

  function boot() {
    var bus = C.EventBus.create();
    var linePicker = C.LinePicker.create({ gameLines: G.Lines, commonLines: C.CommonLines, rng: Math.random });
    // Requirements 1.7: unlock at once when the browser allows audio, else on a gesture (core/sound.js wireUnlock).
    C.Sound.wireUnlock();
    // まわす・うらがえす and ヒント have their own sounds, so they skip the click tone.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b && !b.closest('.fl-act') && !b.classList.contains('fl-hint')) { C.Sound.play('button'); }
    }, true);
    var controller = G.Controller.create({
      bus: bus,
      storage: C.Storage.create('fill'),
      seed: function () { return Math.floor(Math.random() * 4294967296); }
    });
    var ui = null;
    // ui.js starts the loop only on the play screen; it only times the hint shadow, so nothing to pause.
    var loop = C.Loop.create({ onStep: function (ms) { if (ui) { ui.step(ms); } } });
    ui = G.UI.init(document.getElementById('app'), controller, { bus: bus, linePicker: linePicker, loop: loop });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.Ailand);
