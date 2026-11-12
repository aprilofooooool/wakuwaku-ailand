(function (G) {
  'use strict';
  // whack screens: settings (design 3.2), play (3.3), pause (3.4), handoff (3.3) and result (3.5).
  // DOM is touched only after init(). Time runs only while deps.loop runs (countdown and play).
  var C = Ailand.core, K = G.Constants, L = G.Layout, Fx = G.Fx, Sound = C.Sound, Bgm = C.Bgm;

  var PLAYERS = [[1, '1にん'], [2, '2にん']];
  var LEVELS = [['easy', 'かんたん'], ['normal', 'ふつう'], ['hard', 'むずかしい']];
  var MODE_HINT = { together: 'よこに ならんで いっしょに あそぶよ', turns: 'じゅんばんに こうたいで あそぶよ' };
  var HIT_SOUND = { self: 'whack-self', rare: 'whack-rare', ng: 'whack-ng' };
  var HIT_LINE = { self: 'hit', rare: 'rare', ng: 'smug' };   // LinePicker situation per hit kind
  var BUBBLE_MS = 1400;        // a hit line stays this long
  var START_BUBBLE_MS = 2000;  // the start line (shown during 3-2-1)
  var BUBBLE_FADE_MS = 250;    // core/effects.js bubble fade-out
  var HIDE_MS = 220;           // the character sinks back before its hole is cleared (css .wk-pop transition)
  var HANDOFF_SCORE_MS = 1800; // first player's score card before "つぎは … の ばん"
  var RESULT_SOUND_MS = 700;   // record / win / draw sound after the whistle

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function faceInto(wrap, profile, emotion) {
    wrap.innerHTML = '';
    var img = el('img', 'char-img');
    img.draggable = false;
    wrap.appendChild(img);
    C.CharacterView.apply(img, profile, emotion);
  }
  function profileOf(id) { return C.Characters.get(id); }
  // Best score line, same on the settings and result screens (0 = no record yet).
  function bestText(best) { return best > 0 ? 'さいこうきろく ★' + best + 'てん' : 'まだ きろくは ないよ'; }

  function defaultEnv() {
    return {
      maxTouchPoints: (typeof navigator !== 'undefined' && navigator.maxTouchPoints) || 0,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  // deps: { bus, loop, linePicker?, env?, rng? }. Returns { step(ms), showPause(reason), destroy() }.
  function init(root, controller, deps) {
    var d = deps || {};
    var bus = d.bus, loop = d.loop;
    if (!bus || typeof bus.on !== 'function') { throw new Error('whack UI.init: deps.bus (EventBus) is required'); }
    if (!loop || typeof loop.start !== 'function') { throw new Error('whack UI.init: deps.loop (core Loop) is required'); }
    var linePicker = d.linePicker || null;
    var env = d.env || defaultEnv;
    var reactions = G.Reactions.create(d.rng || Math.random);
    var draft = controller.loadSettings();
    var game = null;          // per-round view state (see beginRound)
    var timers = [];

    var settingsScreen = el('main', 'screen wk-settings-screen');
    settingsScreen.id = 'screen-settings';
    var gameScreen = el('main', 'screen wk-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(settingsScreen);
    root.appendChild(gameScreen);

    var header = C.UI.header({
      title: 'キャラたたき',
      soundOn: Sound.isEnabled(),
      onBack: onBack,
      onSound: function () { return Sound.toggleFromTap(); },
      onSettings: openMenu
    });
    document.body.insertBefore(header, document.body.firstChild);

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function sfx(name) { if (game) { Sound.play(name); } }
    function togetherOk() { return L.decideMode(2, env()) === 'together'; }
    function inPlay() { var p = controller.phase(); return !!game && (p === 'countdown' || p === 'playing'); }

    // ---------- settings screen ----------

    var hintEl = null;

    function panel(title) {
      var p = el('section', 'wk-panel');
      p.appendChild(el('h2', null, title));
      settingsScreen.appendChild(p);
      return p;
    }
    function choices(parent, items, isOn, onPick) {
      var row = el('div', 'wk-choices');
      items.forEach(function (it) {
        var b = button('wk-choice', it[1], function () { onPick(it[0]); renderSettings(); });
        b.setAttribute('aria-pressed', String(isOn(it[0])));
        row.appendChild(b);
      });
      parent.appendChild(row);
    }
    function paintHint() { if (hintEl) { hintEl.textContent = MODE_HINT[L.decideMode(2, env())]; } }

    function renderSettings() {
      settingsScreen.innerHTML = '';
      hintEl = null;
      var p1 = panel('なんにんで あそぶ？');
      choices(p1, PLAYERS, function (n) { return n === draft.players; }, function (n) { draft.players = n; });
      if (draft.players === 2) {
        hintEl = p1.appendChild(el('p', 'wk-modehint'));
        paintHint();
      }

      var p2 = panel('キャラ');
      for (var i = 0; i < draft.players; i++) { p2.appendChild(charRow(i)); }

      var p3 = panel('むずかしさ');
      choices(p3, LEVELS, function (id) { return id === draft.difficulty; }, function (id) { draft.difficulty = id; });
      if (draft.players === 1) {
        p3.appendChild(el('p', 'wk-best', bestText(controller.bestOf(draft.difficulty))));
      }

      var p4 = el('section', 'wk-panel wk-startpanel');
      p4.appendChild(button('btn btn-main wk-start', 'はじめる', startGame));
      settingsScreen.appendChild(p4);
    }

    function charRow(i) {
      var row = el('div', 'wk-seatrow');
      var picked = profileOf(draft.chars[i]);
      var label = draft.players === 2 ? (i + 1) + 'P ' + picked.name : picked.name;
      row.appendChild(el('div', 'wk-seatlabel', label));
      var list = el('div', 'wk-charlist');
      C.Characters.list().forEach(function (pf) {
        var b = button('wk-charbtn', undefined, function () {
          // Picking the other player's character swaps the two (no duplicates, same as drop4).
          var other = draft.chars.indexOf(pf.id);
          if (other >= 0 && other !== i) { draft.chars[other] = draft.chars[i]; }
          draft.chars[i] = pf.id;
          renderSettings();
        });
        b.setAttribute('aria-pressed', String(draft.chars[i] === pf.id));
        b.setAttribute('aria-label', (draft.players === 2 ? (i + 1) + 'P：' : '') + pf.name);
        var face = el('span', 'wk-charface');
        faceInto(face, pf, 'normal');
        b.appendChild(face);
        list.appendChild(b);
      });
      row.appendChild(list);
      return row;
    }

    function showSettings() {
      leaveGame();
      settingsScreen.hidden = false;
      draft = controller.loadSettings();
      renderSettings();
      startBgm();
      window.scrollTo(0, 0);
    }

    // ---------- game screen ----------

    function copySettings(s) { return { players: s.players, chars: s.chars.slice(), difficulty: s.difficulty }; }

    function startGame() {
      var s = copySettings(draft);
      var mode = L.decideMode(s.players, env());
      controller.start(s, mode);
      beginRound(s, mode);
    }

    function beginRound(settings, mode) {
      clearTimers();
      Fx.stop();
      detachFields();
      game = { settings: settings, mode: mode, fields: [], playMs: 0, skipStep: false, final: false, bubbleUntil: {}, pauseReason: null };
      buildGame();
      settingsScreen.hidden = true;
      gameScreen.hidden = false;
      document.body.classList.add('wk-playing');
      window.scrollTo(0, 0);
      applyLayout();
      startRound();
    }

    // Common start of a round (also the second player's turn): clock, lines, BGM, loop.
    function startRound() {
      reactions.reset();   // B-3: the combo count starts over each round (also the second player's turn)
      game.playMs = 0;
      game.final = false;
      game.top.classList.remove('is-final');
      renderClock();
      game.fields.forEach(function (f) { clearHoles(f); say(f.player, f.say, f.profile.id, 'start', START_BUBBLE_MS); });
      startBgm();
      loop.start();
    }

    function buildGame() {
      gameScreen.innerHTML = '';
      var wrap = el('div', 'wk-game');
      var top = el('div', 'wk-top');
      var bar = el('div', 'wk-timebar');
      var fill = el('div', 'wk-timefill');
      bar.appendChild(fill);
      var secs = el('div', 'wk-secs');
      top.appendChild(bar);
      top.appendChild(secs);
      var fieldsEl = el('div', 'wk-fields' + (game.mode === 'together' ? ' is-split' : ''));
      var overlay = el('div', 'wk-overlay');
      overlay.hidden = true;
      wrap.appendChild(top);
      wrap.appendChild(fieldsEl);
      wrap.appendChild(overlay);
      gameScreen.appendChild(wrap);
      game.top = top;
      game.fill = fill;
      game.secs = secs;
      game.overlay = overlay;
      var n = game.mode === 'together' ? 2 : 1;
      for (var i = 0; i < n; i++) { game.fields.push(buildField(fieldsEl, i)); }
    }

    function buildField(parent, index) {
      var f = { index: index, player: index, holes: [] };
      var box = el('div', 'wk-field');
      var head = el('div', 'wk-head');
      var faceWrap = el('div', 'wk-facewrap');
      f.face = el('div', 'wk-face');
      f.say = el('div', 'wk-say wk-say-head');
      faceWrap.appendChild(f.face);
      faceWrap.appendChild(f.say);
      f.name = el('span', 'wk-name');
      f.score = el('span', 'wk-score');
      head.appendChild(faceWrap);
      head.appendChild(f.name);
      head.appendChild(f.score);
      var area = el('div', 'wk-area');
      var grid = el('div', 'wk-grid');
      for (var h = 0; h < K.HOLES; h++) {
        var hole = el('div', 'wk-hole');
        var well = el('div', 'wk-well');
        var pop = el('div', 'wk-pop');
        var cbox = el('div', 'wk-charbox');
        var mark = el('span', 'wk-mark');
        mark.setAttribute('aria-hidden', 'true');
        pop.appendChild(cbox);
        pop.appendChild(mark);
        well.appendChild(pop);
        var holeSay = el('div', 'wk-say');
        hole.appendChild(well);
        hole.appendChild(holeSay);
        grid.appendChild(hole);
        f.holes.push({ el: hole, box: cbox, mark: mark, say: holeSay, up: false, hit: false, token: 0 });
      }
      area.appendChild(grid);
      box.appendChild(head);
      box.appendChild(area);
      parent.appendChild(box);
      f.area = area;
      f.detach = C.Pointer.attach(area, { onPress: function (x, y) { press(index, x, y); } });
      setFieldPlayer(f, index);
      return f;
    }

    function setFieldPlayer(f, player) {
      f.player = player;
      f.profile = profileOf(game.settings.chars[player]);
      faceInto(f.face, f.profile, 'normal');
      f.name.textContent = f.profile.name;
      setScore(f, 0);
    }
    function setScore(f, score) {
      f.score.dataset.score = String(score);
      f.score.textContent = '★' + score;
    }
    function fieldOf(side) { return game.mode === 'together' ? game.fields[side] : game.fields[0]; }

    function clearHole(h) {
      h.token++;
      h.up = false;
      h.hit = false;
      h.el.classList.remove('is-up', 'is-hit', 'is-rare');
      delete h.el.dataset.kind;
      h.box.innerHTML = '';
      C.Effects.mark(h.mark, null);
    }
    function clearHoles(f) { f.holes.forEach(clearHole); }
    function detachFields() {
      if (game) { game.fields.forEach(function (f) { if (f.detach) { f.detach(); } }); }
    }

    // Hole size: the largest 3x3 that fits each field's free area (design 3.1), at least 64px.
    function applyLayout() {
      if (!game) { return; }
      game.fields.forEach(function (f) {
        var r = f.area.getBoundingClientRect();
        f.area.style.setProperty('--hole', L.holeSize(r.width, r.height) + 'px');
        f.area.style.setProperty('--gap', L.GAP + 'px');
      });
    }

    function renderClock() {
      var left = Math.max(0, K.DURATION_MS - game.playMs);
      game.fill.style.transform = 'scaleX(' + (left / K.DURATION_MS) + ')';
      var text = Math.ceil(left / 1000) + 'びょう';
      if (game.secs.textContent !== text) { game.secs.textContent = text; }
    }

    // Input (design 4): judged on pointerdown; the nearest showing, not yet hit hole under the finger.
    function press(fieldIndex, x, y) {
      if (!game || controller.phase() !== 'playing' || controller.isPaused()) { return; }
      var f = game.fields[fieldIndex];
      var rects = f.holes.map(function (h) { return h.up && !h.hit ? h.el.getBoundingClientRect() : null; });
      var hole = L.hitHole(x, y, rects);
      if (hole >= 0) { controller.press(game.mode === 'together' ? fieldIndex : 0, hole); }
    }

    // One bubble per side at a time (design 5.1): a new line waits until the previous one is gone.
    function say(side, slot, charId, situation, ms) {
      if (!linePicker || !game) { return; }
      var now = Date.now();
      if ((game.bubbleUntil[side] || 0) > now) { return; }
      var text = linePicker.pick(charId, situation);
      if (!text) { return; }
      var life = ms || BUBBLE_MS;
      C.Effects.bubble(slot, text, life);
      game.bubbleUntil[side] = now + life + BUBBLE_FADE_MS;
    }

    // Settings screen: the BGM at normal tempo (same as the other games). Game: only while playing.
    function startBgm() {
      if (!Sound.isBgmOn()) { Bgm.stop(); return; }
      if (!game) { Bgm.start(G.Sounds.BGM); return; }
      if (!inPlay() || controller.isPaused()) { return; }
      Bgm.start(G.Sounds.BGM);
      if (game.final) { Bgm.setTempo(G.Sounds.FINAL_BPM); }
    }

    // ---------- overlay: pause, handoff, result ----------

    function showOverlay(cls, nodes) {
      var o = game.overlay;
      o.innerHTML = '';
      var card = el('div', 'wk-card ' + (cls || ''));
      nodes.forEach(function (n) { card.appendChild(n); });
      o.appendChild(card);
      o.hidden = false;
      return card;
    }
    function hideOverlay() { if (game) { game.overlay.hidden = true; game.overlay.innerHTML = ''; } }

    function pauseGame(reason) {
      if (!inPlay() || controller.isPaused()) { return false; }
      controller.pause(reason);
      loop.stop();
      showPause(reason);
      return true;
    }

    // Also called by main.js after Loop's onPause (tab hidden), when the controller is already paused.
    function showPause(reason) {
      if (!inPlay()) { return; }
      Bgm.stop();
      game.pauseReason = reason;
      var rotate = reason === 'rotate';
      var go = button('btn btn-main wk-resume', 'つづける', resumeGame);
      go.disabled = rotate && !togetherOk();
      showOverlay('wk-pause', [el('p', 'wk-card-text', rotate ? 'よこむきに もどしてね' : 'ひとやすみ ちゅう'), go]);
    }

    function resumeGame() {
      if (!inPlay()) { return; }
      if (game.mode === 'together' && !togetherOk()) { showPause('rotate'); return; }
      hideOverlay();
      game.pauseReason = null;
      controller.resume();
      startBgm();
      loop.start();
    }

    function showHandoff(player, score) {
      var first = profileOf(game.settings.chars[player]);
      var next = profileOf(game.settings.chars[1 - player]);
      showOverlay('wk-handoff', [el('p', 'wk-card-text wk-big', first.name + ' ★' + score + 'てん')]);
      later(function () {
        showOverlay('wk-handoff', [
          el('p', 'wk-card-text', 'つぎは ' + next.name + ' の ばん'),
          button('btn btn-main wk-next', 'はじめる', function () {
            hideOverlay();
            controller.nextTurn();
            setFieldPlayer(game.fields[0], 1 - player);
            startRound();
          })
        ]);
      }, HANDOFF_SCORE_MS);
    }

    function hero(profile, emotion, cls) {
      var h = el('div', 'wk-hero' + (cls ? ' ' + cls : ''));
      var face = el('div', 'wk-heroface');
      faceInto(face, profile, emotion);
      h.appendChild(face);
      return h;
    }
    function line(charId, situation) { return linePicker ? linePicker.pick(charId, situation) : ''; }

    function showResult(r) {
      var nodes = [];
      var chars = game.settings.chars;
      var sound = null;
      if (r.mode === 'solo') {
        var me = profileOf(chars[0]);
        if (r.newRecord) { nodes.push(el('p', 'wk-card-text wk-record', 'しんきろく！')); }
        var h = hero(me, reactions.forResult(r.newRecord ? 'record' : 'solo'), r.newRecord ? 'is-win' : '');
        h.appendChild(el('p', 'wk-line', line(me.id, r.newRecord ? 'record' : 'end')));
        nodes.push(h);
        nodes.push(el('p', 'wk-result-score', '★' + r.scores[0] + 'てん'));
        if (!r.newRecord) { nodes.push(el('p', 'wk-best', bestText(r.best))); }
        if (r.newRecord) { sound = 'whack-record'; }
      } else {
        var title = r.draw ? 'いいしょうぶ！' : profileOf(chars[r.winner]).name + ' の かち！';
        nodes.push(el('p', 'wk-card-text', title));
        var row = el('div', 'wk-heroes');
        [0, 1].forEach(function (p) {
          var pf = profileOf(chars[p]);
          var win = !r.draw && r.winner === p;
          var hh = hero(pf, reactions.forResult(r.draw ? 'draw' : (win ? 'win' : 'lose')), win ? 'is-win' : 'is-small');
          hh.appendChild(el('p', 'wk-hero-score', pf.name + ' ★' + r.scores[p] + 'てん'));
          hh.appendChild(el('p', 'wk-line', line(pf.id, r.draw ? 'draw' : (win ? 'win' : 'lose'))));
          row.appendChild(hh);
        });
        nodes.push(row);
        sound = r.draw ? 'whack-draw' : 'whack-win';
      }
      var acts = el('div', 'wk-result-actions');
      acts.appendChild(button('btn btn-main wk-again', 'もういっかい', again));
      acts.appendChild(button('btn btn-sub wk-tosettings', 'せっていに もどる', showSettings));
      nodes.push(acts);
      showOverlay('wk-result', nodes);
      if (r.newRecord || (r.mode !== 'solo' && !r.draw)) { Fx.confetti(); }
      if (sound) { later(function () { sfx(sound); }, RESULT_SOUND_MS); }
    }

    function again() {
      var s = copySettings(game.settings);
      var mode = L.decideMode(s.players, env());
      controller.start(s, mode);
      beginRound(s, mode);
    }

    function leaveGame() {
      loop.stop();
      Bgm.stop();
      clearTimers();
      Fx.stop();
      if (controller.phase() !== 'idle') { controller.quit(); }
      detachFields();
      game = null;
      gameScreen.hidden = true;
      gameScreen.innerHTML = '';
      document.body.classList.remove('wk-playing');
    }

    // ---------- header ----------

    function goEntry() {
      leaveGame();
      location.href = C.CharacterView.basePath() + 'index.html';
    }

    // During play, もどる pauses and asks first (design 3.4); a single stray tap never ends the round.
    function onBack() {
      if (!inPlay()) { goEntry(); return; }
      pauseGame('back');
      var m = null;
      var acts = el('div', 'wk-menu');
      acts.appendChild(button('btn btn-main', 'やめる', function () { m.close(); goEntry(); }));
      acts.appendChild(button('btn btn-sub', 'つづける', function () { m.close(); resumeGame(); }));
      m = C.UI.modal('やめる？', [acts]);
    }

    // せってい: さいしょから (back to the settings screen) and BGM ON/OFF. Time stops while it is open.
    function openMenu() {
      pauseGame('menu');
      var nodes = [];
      var m = null;
      if (!gameScreen.hidden) {
        var acts = el('div', 'wk-menu');
        acts.appendChild(button('btn btn-main', 'さいしょから', function () { m.close(); showSettings(); }));
        nodes.push(acts);
      }
      var row = el('div', 'wk-rule');
      row.appendChild(el('span', 'wk-rulename', 'BGM'));
      var opts = el('div', 'wk-choices');
      [[true, 'ON'], [false, 'OFF']].forEach(function (it) {
        var b = button('wk-choice', it[1], function () {
          Sound.setBgmOn(it[0]);
          if (it[0]) { startBgm(); } else { Bgm.stop(); }
          Array.prototype.forEach.call(opts.children, function (x, i) { x.setAttribute('aria-pressed', String((i === 0) === it[0])); });
        });
        b.setAttribute('aria-pressed', String(Sound.isBgmOn() === it[0]));
        opts.appendChild(b);
      });
      row.appendChild(opts);
      nodes.push(row);
      m = C.UI.modal('せってい', nodes);
    }

    // ---------- controller events ----------

    var offs = [];
    function on(name, fn) { offs.push(bus.on(name, function (p) { if (game) { fn(p); } })); }

    on('count', function (p) { Fx.showBanner(String(p.n), 'is-count', 800); sfx('whack-count'); });
    on('go', function () {
      Fx.showBanner('スタート！', 'is-go', 900);
      sfx('whack-go');
      game.playMs = 0;
      game.skipStep = true;   // the step that started play is not play time (controller drops it too)
      renderClock();
    });
    on('show', function (p) {
      var f = fieldOf(p.side), h = f.holes[p.hole];
      clearHole(h);
      h.up = true;
      h.el.dataset.kind = p.kind;
      h.el.classList.toggle('is-rare', p.kind === 'rare');
      faceInto(h.box, profileOf(p.charId), 'normal');
      h.el.classList.add('is-up');
    });
    on('hide', function (p) {
      var h = fieldOf(p.side).holes[p.hole];
      var token = ++h.token;
      h.up = false;
      h.el.classList.remove('is-up', 'is-hit');   // the reaction face sinks back with the character
      setTimeout(function () { if (h.token === token) { clearHole(h); } }, HIDE_MS);
    });
    on('hit', function (p) {
      var f = fieldOf(p.side), h = f.holes[p.hole];
      h.hit = true;
      h.el.classList.add('is-hit');
      var r = reactions.forHit(p.side, p.kind);   // B-3: every 5th own hit in a row is a combo
      faceInto(h.box, profileOf(p.charId), r.emotion);
      C.Effects.mark(h.mark, r.deco || C.CharacterView.markOf(r.emotion));
      Fx.pointsPop(h.el, p.points);
      setScore(f, p.score);
      sfx(HIT_SOUND[p.kind]);
      if (p.kind === 'rare') { Fx.sparkleAt(h.el); }
      // The forbidden character speaks its own smug line (charId is that character).
      say(p.side, h.say, p.charId, r.combo ? 'combo' : HIT_LINE[p.kind]);
    });
    on('final10', function () {
      game.final = true;
      game.top.classList.add('is-final');
      Bgm.setTempo(G.Sounds.FINAL_BPM);
      sfx('whack-final');
      Fx.showBanner('あと 10びょう！', 'is-final', 1000);
    });
    // Play ended inside advance(), before ui.step could count that last step: show 0 seconds.
    function endClock() { game.playMs = K.DURATION_MS; renderClock(); }
    on('turnEnd', function (p) {
      loop.stop();
      endClock();
      Bgm.stop();
      sfx('whack-whistle');
      clearHoles(game.fields[0]);
      showHandoff(p.player, p.score);
    });
    on('result', function (r) {
      loop.stop();
      endClock();
      Bgm.stop();
      sfx('whack-whistle');
      game.fields.forEach(clearHoles);
      showResult(r);
    });

    function onResize() {
      applyLayout();
      paintHint();
      if (!game || game.mode !== 'together' || !inPlay()) { return; }
      if (!togetherOk()) { pauseGame('rotate'); }
      if (controller.isPaused() && game.pauseReason === 'rotate') {
        var b = game.overlay.querySelector('.wk-resume');
        if (b) { b.disabled = !togetherOk(); }
      }
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    showSettings();

    return {
      // Moves the on-screen clock; called after controller.advance on every loop step.
      step: function (ms) {
        if (!game || controller.phase() !== 'playing' || controller.isPaused()) { return; }
        if (game.skipStep) { game.skipStep = false; return; }
        game.playMs = Math.min(K.DURATION_MS, game.playMs + ms);
        renderClock();
      },
      showPause: showPause,
      // Tests: removes the UI, its header and listeners.
      destroy: function () {
        leaveGame();
        offs.forEach(function (off) { if (typeof off === 'function') { off(); } });
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (header.parentNode) { header.parentNode.removeChild(header); }
        root.removeChild(settingsScreen);
        root.removeChild(gameScreen);
      }
    };
  }

  G.UI = { init: init };
})(Ailand.games.whack);
