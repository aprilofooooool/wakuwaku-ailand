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

    bus.on('moved', function (e) {
      batch.mover = e.mover;
      O.Sound.play('place');
      O.Sound.play('flip', { count: e.flipped.length });
    });
    // One full-screen effect and one reaction sound per move: the emotion events of a move are
    // emitted synchronously, so they are collected and the single winner is picked on a 0 ms timer.
    var batch = { emotions: [], mover: null, over: null, timer: null };
    function queueFlush() {
      if (batch.timer === null) { batch.timer = setTimeout(flushEmotions, 0); }
    }
    function flushEmotions() {
      var b = batch;
      batch = { emotions: [], mover: null, over: null, timer: null };
      var emotions = b.emotions.filter(function (x) { return x.emotion !== 'normal'; });
      var s = ctrl.getSettings();
      var pick = O.Reaction.pickEffect(emotions, b.mover, b.over, s ? s.mode : null, humanSeats(s));
      if (!pick) { return; }
      O.Effects.play(pick.emotion, O.UI.panelEl(pick.player));
      O.Sound.play('reaction', { emotion: pick.emotion });
    }
    bus.on('pass', function (e) {
      batch.mover = e.player;
      if (!e.replay) { O.Sound.play('pass'); }
    });
    bus.on('emotion', function (e) { batch.emotions.push(e); queueFlush(); });
    bus.on('gameover', function (e) {
      if (e.replay) { return; } // undo / redo / restore re-emit gameover silently
      var s = ctrl.getSettings();
      var four = !!s && s.mode === 'four';
      batch.over = four ? { winners: e.winners } : e;
      queueFlush();
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
