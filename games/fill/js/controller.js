(function (G) {
  'use strict';
  var K = G.Constants;
  var SETTINGS_KEY = 'settings.v1';
  var ZUKAN_KEY = 'zukan.v1';

  function defaults() { return { char: 'mametchi', tab: 'easy', seenHowTo: false }; }
  function validChar(id) { return typeof id === 'string' && K.CHARS.indexOf(id) >= 0; }
  function validTab(t) { return typeof t === 'string' && K.LEVELS.indexOf(t) >= 0; }

  function create(deps) {
    var bus = deps.bus, storage = deps.storage;
    var pictures = deps.pictures || G.Pictures;
    var seedCount = 0;
    var curPhase = 'zukan', curId = null, puz = null, eng = null, result = null;

    function pictureById(id) {
      for (var i = 0; i < pictures.length; i++) { if (pictures[i].id === id) { return pictures[i]; } }
      return null;
    }
    function ofLevel(level) { return pictures.filter(function (p) { return p.level === level; }); }

    function loadSettings() {
      var s = storage.get(SETTINGS_KEY, null);
      var d = defaults();
      if (!s || typeof s !== 'object' || Array.isArray(s)) { return d; }
      return {
        char: validChar(s.char) ? s.char : d.char,
        tab: validTab(s.tab) ? s.tab : d.tab,
        seenHowTo: s.seenHowTo === true
      };
    }
    function saveSettings(s) {
      storage.set(SETTINGS_KEY, { char: s.char, tab: s.tab, seenHowTo: s.seenHowTo });
    }

    function zukan() {
      var z = storage.get(ZUKAN_KEY, null);
      var out = {};
      if (!z || typeof z !== 'object' || Array.isArray(z)) { return out; }
      Object.keys(z).forEach(function (id) {
        var v = z[id];
        if (!pictureById(id) || !v || typeof v !== 'object' || v.done !== true) { return; }
        out[id] = { done: true, sparkle: v.sparkle === true };
      });
      return out;
    }

    function listOf(level) {
      var z = zukan();
      return ofLevel(level).map(function (p) {
        var e = z[p.id];
        return { picture: p, done: !!e, sparkle: !!(e && e.sparkle) };
      });
    }
    function doneCount(level) {
      return listOf(level).filter(function (x) { return x.done; }).length;
    }

    function start(pictureId) {
      var pic = pictureById(pictureId);
      if (!pic) { throw new Error('fill: unknown picture ' + pictureId); }
      curId = pictureId;
      seedCount++;
      puz = G.Puzzle.make(pic, deps.seed() + seedCount);
      eng = G.Engine.create(puz);
      result = null;
      curPhase = 'play';
      bus.emit('start', { pictureId: pictureId });
    }

    function finish() {
      var pic = pictureById(curId);
      var z = zukan();
      var before = z[curId];
      var pageBefore = doneCount(pic.level) === ofLevel(pic.level).length;
      var sparkle = !!(before && before.sparkle) || !eng.hintUsed();
      z[curId] = { done: true, sparkle: sparkle };
      storage.set(ZUKAN_KEY, z);
      var pageNow = doneCount(pic.level) === ofLevel(pic.level).length;
      curPhase = 'done';
      result = {
        pictureId: curId,
        sparkle: sparkle,
        sparkleNew: sparkle && !(before && before.sparkle),
        pageDone: pageNow && !pageBefore
      };
      bus.emit('done', result);
    }

    function handle(events) {
      var cleared = false;
      events.forEach(function (e) {
        bus.emit(e.type, e);
        if (e.type === 'clear') { cleared = true; }
      });
      if (cleared) { finish(); }
      return events;
    }

    function playing() { return curPhase === 'play' && !!eng; }

    function nextPictureId(currentId) {
      var cur = pictureById(currentId);
      var list = listOf(cur.level);
      var idx = 0, i;
      for (i = 0; i < list.length; i++) { if (list[i].picture.id === currentId) { idx = i; } }
      for (i = idx + 1; i < list.length; i++) { if (!list[i].done) { return list[i].picture.id; } }
      for (i = 0; i < idx; i++) { if (!list[i].done) { return list[i].picture.id; } }
      return list[(idx + 1) % list.length].picture.id;
    }

    var api = {
      loadSettings: loadSettings,
      saveSettings: saveSettings,
      needsHowTo: function () { return !loadSettings().seenHowTo; },
      markHowToSeen: function () {
        var s = loadSettings();
        s.seenHowTo = true;
        saveSettings(s);
      },
      zukan: zukan,
      listOf: listOf,
      doneCount: doneCount,
      start: start,
      drop: function (id, x, y) { return playing() ? handle(eng.drop(id, x, y)) : []; },
      toTray: function (id) { return playing() ? handle(eng.toTray(id)) : []; },
      turn: function (id, kind) { return playing() ? handle(eng.turn(id, kind)) : []; },
      // The engine throws when nothing is left to hint, so only ask it while playing.
      hint: function (rand) {
        if (!playing()) { return null; }
        var h = eng.hint(rand || Math.random);
        bus.emit('hint', h);
        return h;
      },
      restart: function () { start(curId); },
      needsQuitConfirm: function () { return !!eng && curPhase === 'play' && eng.placedCount() > 0; },
      quit: function () { curPhase = 'zukan'; },
      nextPictureId: nextPictureId,
      phase: function () { return curPhase; },
      engine: function () { return eng; },
      puzzle: function () { return puz; }
    };
    Object.defineProperty(api, 'result', { get: function () { return result; }, enumerable: true });
    return api;
  }

  G.Controller = { create: create, SETTINGS_KEY: SETTINGS_KEY, ZUKAN_KEY: ZUKAN_KEY };
})(Ailand.games.fill);
