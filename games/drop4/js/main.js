(function (A) {
  'use strict';
  // Wires the drop4 controller to real dependencies and starts the UI. Task 17 adds sound and effects here.
  var C = A.core, D = A.games.drop4;

  function boot() {
    var bus = C.EventBus.create();
    var rng = Math.random;
    var controller = D.Controller.create({
      bus: bus,
      rng: rng,
      scheduler: function (fn, ms) { setTimeout(fn, ms || 0); },
      storage: C.Storage.create('drop4'),
      ai: D.Ai,
      now: function () { return performance.now(); },
      linePicker: C.LinePicker.create({ gameLines: D.Lines, commonLines: C.CommonLines, rng: rng })
    });
    D.UI.init(document.getElementById('app'), controller, { bus: bus });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.Ailand);
