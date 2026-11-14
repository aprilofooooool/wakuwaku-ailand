(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Ctl = A.games.blocks.Controller;
  var STEP = 1000 / 60;
  var SET = { char: 'mametchi', difficulty: 'easy', seenHowTo: false };

  function fakeStorage(init) {
    var m = init || {};
    return {
      m: m,
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : fb; },
      set: function (k, v) { m[k] = v; },
      remove: function (k) { delete m[k]; },
      has: function (k) { return Object.prototype.hasOwnProperty.call(m, k); }
    };
  }
  var NAMES = ['count', 'go', 'spawn', 'moved', 'lock', 'clear', 'collapse', 'goal', 'over', 'danger', 'result'];
  function make(init) {
    var bus = A.core.EventBus.create(), log = [], storage = fakeStorage(init);
    NAMES.forEach(function (n) { bus.on(n, function (p) { log.push({ name: n, p: p }); }); });
    var ctl = Ctl.create({ bus: bus, storage: storage, seed: function () { return 7; } });
    return { ctl: ctl, log: log, storage: storage };
  }
  function names(log) { return log.map(function (e) { return e.name; }); }
  function count(log, n) { return names(log).filter(function (x) { return x === n; }).length; }
  function toPlaying(t) {
    t.ctl.start(SET);
    while (t.ctl.phase() === 'countdown') { t.ctl.advance(STEP); }
  }
  // Puts an O piece at x=4 (cells x+1, x+2) so hold tests are deterministic.
  function setO(t) {
    var g = t.ctl.game();
    g.piece = { shape: 'O', charId: g.piece.charId, x: 4, y: 0, rot: 0 };
  }

  describe('blocks/Controller', function () {
    it('countdown then play', function () {
      var t = make();
      t.ctl.start(SET);
      expect(t.ctl.phase()).toBe('countdown');
      var n = 0;
      while (t.ctl.phase() === 'countdown' && n < 1000) { t.ctl.advance(STEP); n++; }
      var counts = t.log.filter(function (e) { return e.name === 'count'; }).map(function (e) { return e.p.n; });
      expect(counts.join(',')).toBe('3,2,1');
      var ns = names(t.log);
      expect(ns.indexOf('go') > ns.lastIndexOf('count')).toBe(true);
      expect(ns.indexOf('spawn') > ns.indexOf('go')).toBe(true);
      expect(t.ctl.phase()).toBe('playing');
      expect(t.log[ns.indexOf('spawn')].p.shape).toBe(t.ctl.game().piece.shape);
    });
    it('holding left repeats after 170ms every 50ms', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      expect(t.ctl.press('left')).toBe(true);
      expect(g.piece.x).toBe(3);
      t.ctl.advance(169);
      expect(g.piece.x).toBe(3);
      t.ctl.advance(1);
      expect(g.piece.x).toBe(2);
      t.ctl.advance(49);
      expect(g.piece.x).toBe(2);
      t.ctl.advance(1);
      expect(g.piece.x).toBe(1);
      t.ctl.release('left');
      t.ctl.advance(500);
      expect(g.piece.x).toBe(1);
      t.ctl.release('left');
      expect(count(t.log, 'moved')).toBe(3);
    });
    it('most recently pressed horizontal wins', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.press('right');
      expect(g.piece.x).toBe(4);
      t.ctl.advance(170);
      expect(g.piece.x).toBe(5);
    });
    it('soft drop repeats every 50ms while held', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      var y0 = g.piece.y;
      t.ctl.press('soft');
      expect(g.piece.y).toBe(y0 + 1);
      t.ctl.advance(49);
      expect(g.piece.y).toBe(y0 + 1);
      t.ctl.advance(1);
      expect(g.piece.y).toBe(y0 + 2);
      t.ctl.advance(50);
      expect(g.piece.y).toBe(y0 + 3);
      t.ctl.release('soft');
      t.ctl.advance(100);
      expect(g.piece.y).toBe(y0 + 3);
    });
    it('pause releases held buttons', function () {
      var t = make();
      toPlaying(t);
      setO(t);
      var g = t.ctl.game();
      t.ctl.press('left');
      t.ctl.pause('hidden');
      expect(t.ctl.isPaused()).toBe(true);
      var y = g.piece.y;
      t.ctl.advance(5000);
      expect(g.piece.y).toBe(y);
      expect(g.piece.x).toBe(3);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.resume();
      t.ctl.advance(1000);
      expect(g.piece.x).toBe(3);
    });
    it('press is refused outside playing', function () {
      var t = make();
      t.ctl.start(SET);
      expect(t.ctl.press('left')).toBe(false);
      t.ctl.release('left');
    });
    it('goal and over end with a result', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      for (var r = 20; r < 22; r++) {
        for (var c = 0; c < 10; c++) { if (c !== 4 && c !== 5) { g.board[r][c] = { charId: 'mametchi' }; } }
      }
      g.goal = 1;
      g.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      t.ctl.press('hard');
      expect(t.ctl.phase()).toBe('playing');
      t.ctl.advance(300);
      expect(t.ctl.phase()).toBe('result');
      var res = t.log.filter(function (e) { return e.name === 'result'; })[0].p;
      expect(res.cleared).toBe(true);
      expect(res.goal).toBe(1);
      expect(res.char).toBe('mametchi');
      expect(count(t.log, 'goal')).toBe(1);

      var o = make();
      toPlaying(o);
      var h = o.ctl.game();
      h.board[2][4] = { charId: 'x' };
      h.board[2][5] = { charId: 'x' };
      h.piece = { shape: 'O', charId: 'mametchi', x: 3, y: 0, rot: 0 };
      o.ctl.press('hard');
      expect(o.ctl.phase()).toBe('result');
      expect(o.log[o.log.length - 1].p.cleared).toBe(false);
      expect(count(o.log, 'over')).toBe(1);
      expect(o.ctl.press('left')).toBe(false);
    });
    it('danger is emitted only on change', function () {
      var t = make();
      toPlaying(t);
      var g = t.ctl.game();
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(0);
      g.board[5][0] = { charId: 'x' };
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(1);
      expect(t.log.filter(function (e) { return e.name === 'danger'; })[0].p.on).toBe(true);
      g.board[5][0] = null;
      t.ctl.advance(STEP);
      t.ctl.advance(STEP);
      expect(count(t.log, 'danger')).toBe(2);
      expect(t.log.filter(function (e) { return e.name === 'danger'; })[1].p.on).toBe(false);
    });
    it('broken settings fall back per field', function () {
      var def = JSON.stringify(SET);
      [null, 'x', 5, [1]].forEach(function (bad) {
        expect(JSON.stringify(make({ 'settings.v1': bad }).ctl.loadSettings())).toBe(def);
      });
      var a = make({ 'settings.v1': { char: 'nobody', difficulty: 'hard', seenHowTo: true } }).ctl.loadSettings();
      expect(a.char).toBe('mametchi');
      expect(a.difficulty).toBe('hard');
      expect(a.seenHowTo).toBe(true);
      var b = make({ 'settings.v1': { char: 'mimitchi', difficulty: 'insane', seenHowTo: 'yes' } }).ctl.loadSettings();
      expect(b.char).toBe('mimitchi');
      expect(b.difficulty).toBe('easy');
      expect(b.seenHowTo).toBe(false);
    });
    it('how-to is shown once', function () {
      var t = make();
      expect(t.ctl.needsHowTo()).toBe(true);
      t.ctl.markHowToSeen();
      expect(t.ctl.needsHowTo()).toBe(false);
      expect(t.storage.m['settings.v1'].seenHowTo).toBe(true);
    });
    it('start saves the settings', function () {
      var t = make();
      var s = { char: 'flowertchi', difficulty: 'normal', seenHowTo: true };
      t.ctl.start(s);
      expect(JSON.stringify(t.storage.m['settings.v1'])).toBe(JSON.stringify(s));
      expect(t.ctl.game().selfId).toBe('flowertchi');
      expect(t.ctl.game().goal).toBe(20);
    });
  });
})(Ailand);
