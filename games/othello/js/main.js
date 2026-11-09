(function (O) {
  'use strict';
  // Startup wiring: controller + UI + sound + effects. Nothing here depends on the page origin (http or file).

  function start() {
    var bus = O.bus;
    var ctrl = O.GameController.create({});

    // iOS can re-suspend the AudioContext, and only some gesture events count as unlocking it,
    // so unlock on each of them (unlock is idempotent).
    ['pointerdown', 'touchend', 'click'].forEach(function (type) {
      document.addEventListener(type, function () { O.Sound.unlock(); }, true);
    });
    // One delegated button sound; board cells have their own place/flip sounds.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b && !b.disabled && !b.classList.contains('cell')) { O.Sound.play('button'); }
    }, true);

    // Four mode: the human seat keys (settings.humans is a count; seats p1..p<humans> are human).
    function humanSeats(s) {
      return s && s.mode === 'four' ? ['p1', 'p2', 'p3', 'p4'].slice(0, s.humans) : undefined;
    }

    // One full-screen effect and one reaction sound per move (games/othello/js/game/move-reaction.js).
    var reaction = O.MoveReaction.create({
      context: function () {
        var s = ctrl.getSettings();
        return { mode: s ? s.mode : null, humans: humanSeats(s) };
      },
      onPick: function (pick) {
        O.Effects.play(pick.emotion, O.UI.panelEl(pick.player));
        O.Sound.play('reaction', { emotion: pick.emotion });
      }
    });

    bus.on('moved', function (e) {
      reaction.mover(e.mover);
      O.Sound.play('place');
      O.Sound.play('flip', { count: e.flipped.length });
    });
    bus.on('pass', function (e) {
      reaction.mover(e.player);
      if (!e.replay) { O.Sound.play('pass'); }
    });
    bus.on('emotion', function (e) { reaction.emotion(e); });
    bus.on('gameover', function (e) {
      if (e.replay) { return; } // undo / redo / restore re-emit gameover silently
      var s = ctrl.getSettings();
      var four = !!s && s.mode === 'four';
      reaction.over(four ? { winners: e.winners } : e);
      var name;
      if (four) {
        name = humanSeats(s).some(function (p) { return e.winners.indexOf(p) >= 0; }) ? 'win' : 'lose';
      } else if (e.winner === null) { name = 'draw'; }
      else if (s && s.mode === 'solo') { name = e.winner === 'p1' ? 'win' : 'lose'; }
      else { name = 'win'; }
      O.Sound.play(name);
    });

    O.UI.init({
      onStart: function (settings) {
        O.UI.bindGame(ctrl);
        ctrl.start(settings);
        O.UI.announceColors(); // four mode only; restore never announces
      },
      onResume: function () {
        O.UI.bindGame(ctrl);
        if (!ctrl.restore()) { O.UI.leave(); return; } // the save was unusable: back to the top, no stale board
        ctrl.notifyActivity();
      }
    });
    // BGM follows the shared sound flag at once, wherever it was flipped (games/othello/js/audio/othello-bgm.js).
    Ailand.core.Sound.onChange(function () { O.BgmLink.sync(); });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})(Ailand.games.othello);
