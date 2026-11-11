(function (A) {
  'use strict';
  var describe = A.Test.describe, it = A.Test.it, expect = A.Test.expect;
  var Ctl = A.games.whack.Controller;
  var STEP = A.core.Loop.STEP_MS;
  var TWO = { players: 2, chars: ['mametchi', 'kuchipatchi'], difficulty: 'easy' };
  var SOLO = { players: 1, chars: ['mametchi', 'kuchipatchi'], difficulty: 'easy' };

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
  var NAMES = ['count', 'go', 'show', 'hide', 'hit', 'end', 'final10', 'turnEnd', 'result'];
  function make(init) {
    var bus = A.core.EventBus.create(), log = [], storage = fakeStorage(init);
    NAMES.forEach(function (n) { bus.on(n, function (p) { log.push({ name: n, p: p }); }); });
    var ctl = Ctl.create({ bus: bus, storage: storage, seed: function () { return 7; } });
    return { ctl: ctl, log: log, storage: storage };
  }
  function names(log) { return log.map(function (e) { return e.name; }); }
  function shows(log, side) {
    return log.filter(function (e) { return e.name === 'show' && e.p.side === side; })
      .map(function (e) { return e.p.hole + ':' + e.p.kind + ':' + e.p.charId; });
  }
  function holeKind(list) { return list.map(function (s) { return s.split(':').slice(0, 2).join(':'); }); }

  // Advances in STEP slices until phase leaves countdown/playing, `until` is true, or maxMs passes.
  // t.onShow(payload) may press right after a show appears.
  function run(t, maxMs, until) {
    var ms = 0;
    while (ms < maxMs && (t.ctl.phase() === 'countdown' || t.ctl.phase() === 'playing') && !(until && until())) {
      var before = t.log.length;
      t.ctl.advance(STEP);
      ms += STEP;
      t.log.slice(before).forEach(function (e) { if (t.onShow && e.name === 'show') { t.onShow(e.p); } });
    }
  }
  // Presses the first n self characters right when they appear (solo score n).
  function scoreN(t, n) {
    var hits = 0;
    t.onShow = function (p) {
      if (p.kind === 'self' && hits < n) { hits++; t.ctl.press(p.side, p.hole); }
    };
  }

  describe('whack/Controller', function () {
    it('solo runs countdown, play and result', function () {
      var t = make();
      t.ctl.start(SOLO, 'solo');
      expect(t.ctl.phase()).toBe('countdown');
      run(t, 60000);
      var ns = names(t.log);
      var counts = t.log.filter(function (e) { return e.name === 'count'; }).map(function (e) { return e.p.n; });
      expect(counts.join(',')).toBe('3,2,1');
      expect(ns.indexOf('go') > ns.lastIndexOf('count')).toBe(true);
      expect(ns.indexOf('show') > ns.indexOf('go')).toBe(true);
      expect(ns[ns.length - 1]).toBe('result');
      expect(t.ctl.phase()).toBe('result');
      expect(t.log[ns.indexOf('go')].p.player).toBe(0);
    });
    it('final10 fires once at 40s', function () {
      var t = make();
      t.ctl.start(SOLO, 'solo');
      var playMs = 0, at = null;
      while (t.ctl.phase() !== 'result') {
        var wasPlaying = t.ctl.phase() === 'playing';
        t.ctl.advance(STEP);
        if (wasPlaying) { playMs += STEP; }
        if (at === null && names(t.log).indexOf('final10') >= 0) { at = playMs; }
      }
      expect(names(t.log).filter(function (n) { return n === 'final10'; }).length).toBe(1);
      expect(at >= 40000 && at < 40000 + 2 * STEP).toBe(true);
    });
    it('together steps both sides with the same holes', function () {
      var t = make();
      t.ctl.start(TWO, 'together');
      run(t, 60000);
      var a = shows(t.log, 0), b = shows(t.log, 1);
      expect(a.length > 10).toBe(true);
      expect(holeKind(a).join('|')).toBe(holeKind(b).join('|'));
      expect(a.every(function (s) { return s.indexOf(':self:') < 0 || /:mametchi$/.test(s); })).toBe(true);
      expect(b.every(function (s) { return s.indexOf(':self:') < 0 || /:kuchipatchi$/.test(s); })).toBe(true);
      expect(t.ctl.phase()).toBe('result');
    });
    it('turns hands off and replays the same schedule', function () {
      var t = make();
      t.ctl.start(TWO, 'turns');
      run(t, 60000);
      expect(t.ctl.phase()).toBe('handoff');
      var te = t.log.filter(function (e) { return e.name === 'turnEnd'; });
      expect(te.length).toBe(1);
      expect(te[0].p.player).toBe(0);
      var first = shows(t.log, 0);
      expect(first.length > 10).toBe(true);
      expect(shows(t.log, 1).length).toBe(0);
      t.ctl.advance(1000);
      expect(t.ctl.phase()).toBe('handoff');
      t.ctl.nextTurn();
      expect(t.ctl.phase()).toBe('countdown');
      run(t, 60000);
      expect(t.ctl.phase()).toBe('result');
      var second = shows(t.log, 1);
      expect(holeKind(second).join('|')).toBe(holeKind(first).join('|'));
      expect(second.every(function (s) { return s.indexOf(':self:') < 0 || /:kuchipatchi$/.test(s); })).toBe(true);
      expect(t.log.filter(function (e) { return e.name === 'go'; }).map(function (e) { return e.p.player; }).join(',')).toBe('0,1');
    });
    it('paused advance does not move time', function () {
      var t = make();
      t.ctl.start(SOLO, 'solo');
      run(t, 60000, function () { return shows(t.log, 0).length >= 1; });
      var n = shows(t.log, 0).length;
      var hole = t.log.filter(function (e) { return e.name === 'show'; })[0].p.hole;
      t.ctl.pause('hidden');
      expect(t.ctl.isPaused()).toBe(true);
      t.ctl.advance(10000);
      expect(shows(t.log, 0).length).toBe(n);
      expect(t.ctl.press(0, hole)).toBe(null);
      t.ctl.resume();
      expect(t.ctl.isPaused()).toBe(false);
      expect(t.ctl.phase()).toBe('playing');
      run(t, 60000);
      expect(t.ctl.phase()).toBe('result');
      expect(shows(t.log, 0).length > n).toBe(true);
    });
    it('best record updates only in solo', function () {
      var t = make();
      t.ctl.start(SOLO, 'solo');
      scoreN(t, 3);
      run(t, 60000);
      var r = t.ctl.getResult();
      expect(r.scores[0]).toBe(3);
      expect(r.newRecord).toBe(true);
      expect(r.best).toBe(3);
      expect(t.ctl.bestOf('easy')).toBe(3);
      expect(t.ctl.bestOf('hard')).toBe(0);
      expect(t.ctl.getResult().newRecord).toBe(true);

      t.ctl.start(SOLO, 'solo');
      scoreN(t, 2);
      run(t, 60000);
      r = t.ctl.getResult();
      expect(r.scores[0]).toBe(2);
      expect(r.newRecord).toBe(false);
      expect(r.best).toBe(3);

      t.ctl.start(TWO, 'together');
      t.onShow = function (p) { if (p.kind === 'self' && p.side === 0) { t.ctl.press(0, p.hole); } };
      run(t, 60000);
      r = t.ctl.getResult();
      expect(r.winner).toBe(0);
      expect(r.draw).toBe(false);
      expect(r.newRecord).toBe(false);
      expect(t.ctl.bestOf('easy')).toBe(3);

      var z = make();
      z.ctl.start(SOLO, 'solo');
      run(z, 60000);
      expect(z.ctl.getResult().scores[0]).toBe(0);
      expect(z.ctl.getResult().newRecord).toBe(false);
      expect(z.ctl.bestOf('easy')).toBe(0);
    });
    it('reports a draw on equal scores in two-player mode', function () {
      var t = make();
      t.ctl.start(TWO, 'together');
      run(t, 60000);
      var r = t.ctl.getResult();
      expect(r.draw).toBe(true);
      expect(r.winner).toBe(null);
    });
    it('broken settings fall back to defaults', function () {
      var def = JSON.stringify(SOLO);
      [
        { players: 3, chars: ['mametchi', 'kuchipatchi'], difficulty: 'easy' },
        { players: 1, chars: ['mametchi', 'nobody'], difficulty: 'easy' },
        { players: 2, chars: ['mimitchi', 'mimitchi'], difficulty: 'easy' },
        { players: 2, chars: ['mimitchi', 'flowertchi'], difficulty: 'insane' }
      ].forEach(function (bad) {
        var t = make({ 'settings.v1': bad });
        expect(JSON.stringify(t.ctl.loadSettings())).toBe(def);
      });
      var ok = make({ 'settings.v1': { players: 2, chars: ['mimitchi', 'flowertchi'], difficulty: 'hard' } });
      expect(ok.ctl.loadSettings().difficulty).toBe('hard');
    });
    it('start saves the settings', function () {
      var t = make();
      var s = { players: 2, chars: ['mimitchi', 'flowertchi'], difficulty: 'normal' };
      t.ctl.start(s, 'together');
      expect(JSON.stringify(t.storage.m['settings.v1'])).toBe(JSON.stringify(s));
      expect(JSON.stringify(t.ctl.loadSettings())).toBe(JSON.stringify(s));
    });
  });
})(Ailand);
