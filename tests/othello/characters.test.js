(function (O) {
  'use strict';
  var C = O.Const;
  var CM = O.CharacterManager;
  var EMOTIONS = ['normal', 'joy', 'anger', 'sadness', 'panic', 'thinking'];

  function chars() { return CM.list(); }
  function lines(c) { return O.Lines[c.id]; }
  function picker(rng) {
    return Ailand.core.LinePicker.create({ gameLines: O.Lines, commonLines: Ailand.core.CommonLines, rng: rng });
  }

  // rng that returns the given values in order, then repeats the last one.
  function seq(values) {
    var i = 0;
    return function () { var v = values[Math.min(i, values.length - 1)]; i += 1; return v; };
  }

  describe('Characters data', function () {
    it('4 characters in the fixed order', function () {
      expect(chars().map(function (c) { return c.id; })).toEqual(['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi']);
    });
    it('the roster is core/characters.js (one source)', function () {
      expect(chars()).toEqual(Ailand.core.Characters.list());
    });
    it('main colors are all different', function () {
      var mains = chars().map(function (c) { return c.colors.main.toLowerCase(); });
      mains.forEach(function (m, i) { expect(mains.indexOf(m)).toBe(i); });
      chars().forEach(function (c) { expect(typeof c.colors.sub).toBe('string'); });
    });
    it('face has all 6 emotions', function () {
      chars().forEach(function (c) {
        EMOTIONS.forEach(function (e) { expect(typeof c.face[e] === 'string' && c.face[e].length > 0).toBeTruthy(); });
      });
    });
    it('voice: firstPerson and ending', function () {
      var v = {};
      chars().forEach(function (c) { v[c.id] = c.voice; });
      expect(v.mametchi).toEqual({ firstPerson: 'ぼく', ending: null });
      expect(v.kuchipatchi).toEqual({ firstPerson: 'ぼく', ending: 'だっち' });
      expect(v.mimitchi).toEqual({ firstPerson: 'わたし', ending: 'ぴょん' });
      expect(v.flowertchi).toEqual({ firstPerson: 'わたし', ending: null });
    });
    it('every core character x every situation has 3+ lines', function () {
      chars().forEach(function (c) {
        O.SITUATIONS.forEach(function (s) {
          var list = lines(c)[s];
          if (!Array.isArray(list) || list.length < 3) { throw new Error(c.id + '.' + s + ' has fewer than 3 lines'); }
        });
      });
    });
    it('every line is non-empty and at most BUBBLE_MAX_CHARS characters', function () {
      expect(C.BUBBLE_MAX_CHARS).toBe(20);
      chars().forEach(function (c) {
        O.SITUATIONS.forEach(function (s) {
          lines(c)[s].forEach(function (line) {
            var n = Array.from(line).length;
            if (n === 0 || n > C.BUBBLE_MAX_CHARS) { throw new Error(c.id + '.' + s + ' "' + line + '" is ' + n + ' chars'); }
          });
        });
      });
    });
    it('no duplicates within a situation', function () {
      chars().forEach(function (c) {
        O.SITUATIONS.forEach(function (s) {
          lines(c)[s].forEach(function (line, i) {
            if (lines(c)[s].indexOf(line) !== i) { throw new Error(c.id + '.' + s + ' duplicate "' + line + '"'); }
          });
        });
      });
    });
    it('characters with an ending use it in 80%+ of all lines', function () {
      chars().forEach(function (c) {
        if (!c.voice.ending) { return; }
        var total = 0;
        var hit = 0;
        O.SITUATIONS.forEach(function (s) {
          lines(c)[s].forEach(function (line) {
            total += 1;
            if (line.indexOf(c.voice.ending) >= 0) { hit += 1; }
          });
        });
        expect(hit / total).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('LinePicker', function () {
    it('200 picks for the same character and situation never repeat in a row', function () {
      var p = picker(Math.random);
      chars().forEach(function (c) {
        O.SITUATIONS.forEach(function (s) {
          var prev = null;
          for (var i = 0; i < 200; i += 1) {
            var line = p.pick(c.id, s);
            expect(lines(c)[s]).toContain(line);
            if (line === prev) { throw new Error('repeated ' + c.id + '.' + s + ' "' + line + '"'); }
            prev = line;
          }
        });
      });
    });
    it('a fixed rng that would repeat still gets a different line', function () {
      var p = picker(function () { return 0; });
      var a = p.pick('mametchi', 'win');
      var b = p.pick('mametchi', 'win');
      expect(a === b).toBeFalsy();
    });
    it('history is kept per character and per situation', function () {
      var p = picker(seq([0]));
      var first = O.Lines.mametchi.win[0];
      expect(p.pick('mametchi', 'win')).toBe(first);
      expect(p.pick('mametchi', 'lose')).toBe(O.Lines.mametchi.lose[0]);
      expect(p.pick('kuchipatchi', 'win')).toBe(O.Lines.kuchipatchi.win[0]);
    });
  });

  describe('CharacterManager', function () {
    var m = chars()[0];
    it('get returns the character or null', function () {
      expect(CM.get('mimitchi').name).toBe('みみっち');
      expect(CM.get('nobody')).toBe(null);
    });
    // B = data-base of the page ('' in Node); dirs come from core/characters.js (root-relative).
    var B = Ailand.core.CharacterView.basePath();
    it('imagePath joins base, dir, name and ext', function () {
      expect(CM.imagePath(m, 'joy')).toBe(B + 'assets/characters/mametchi/joy.png');
    });
    it('imageCandidates: emotion then normal, one entry for normal', function () {
      expect(CM.imageCandidates(m, 'anger')).toEqual([B + 'assets/characters/mametchi/anger.png', B + 'assets/characters/mametchi/normal.png']);
      expect(CM.imageCandidates(m, 'normal')).toEqual([B + 'assets/characters/mametchi/normal.png']);
    });
    it('discCandidates is the normal image', function () {
      expect(CM.discCandidates(m)).toEqual([B + 'assets/characters/mametchi/normal.png']);
    });
    it('isSelectable: same id as the other side is false', function () {
      expect(CM.isSelectable('mametchi', 'mametchi')).toBe(false);
      expect(CM.isSelectable('mametchi', 'mimitchi')).toBe(true);
      expect(CM.isSelectable('mametchi', null)).toBe(true);
      expect(CM.isSelectable('nobody', null)).toBe(false);
    });
    it('fillSeats: humans=1、p1=mametchi → 残り3体がロスター順で CPU', function () {
      expect(CM.fillSeats(['mametchi', null, null, null], 1)).toEqual(['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi']);
      expect(CM.fillSeats(['mimitchi', null, null, null], 1)).toEqual(['mimitchi', 'mametchi', 'kuchipatchi', 'flowertchi']);
    });
    it('fillSeats: humans=2 で2席が同じキャラ → 2席目は null', function () {
      var r = CM.fillSeats(['mametchi', 'mametchi', null, null], 2);
      expect(r[0]).toBe('mametchi');
      expect(r[1]).toBe(null);
      expect(r.length).toBe(4);
    });
    it('fillSeats: 不正 id は null、結果に重複なし', function () {
      var r = CM.fillSeats(['nobody', 'mimitchi', 'mimitchi', null], 3);
      expect(r.slice(0, 3)).toEqual([null, 'mimitchi', null]);
      var ids = r.filter(function (x) { return x !== null; });
      expect(ids.length).toBe(new Set(ids).size);
      var full = CM.fillSeats(['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi'], 4);
      expect(full).toEqual(['mametchi', 'kuchipatchi', 'mimitchi', 'flowertchi']);
    });
    it('pickCpu: 1000 tries never return excludeId and all other 3 appear', function () {
      var seen = {};
      for (var i = 0; i < 1000; i += 1) {
        var c = CM.pickCpu('kuchipatchi', Math.random);
        if (c.id === 'kuchipatchi') { throw new Error('returned excluded id'); }
        seen[c.id] = true;
      }
      expect(Object.keys(seen).sort()).toEqual(['flowertchi', 'mametchi', 'mimitchi']);
    });
    it('pickCpu covers both ends of the rng range', function () {
      expect(CM.pickCpu('mametchi', function () { return 0; }).id).toBe('kuchipatchi');
      expect(CM.pickCpu('mametchi', function () { return 0.999999; }).id).toBe('flowertchi');
    });
  });
})(Ailand.games.othello);
