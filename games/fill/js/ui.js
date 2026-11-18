(function (G) {
  'use strict';
  // fill screens: zukan (design 4.3) and play (4.4) with drag (2.3). Copied from the chain UI and adapted.
  // DOM is touched only after init(). The loop runs only on the play screen (it times the hint shadow).
  var C = Ailand.core, K = G.Constants, L = G.Layout, R = G.Render, P = G.Piece, Sound = C.Sound, Bgm = C.Bgm, Fx = G.Fx;

  var LEVELS = [['easy', 'かんたん'], ['normal', 'ふつう'], ['hard', 'むずかしい']];
  var ACTS = [['rotate', '↻', 'まわす']];
  var TRAY_CELL = 24;          // tray piece cell (px) at scale 1: the size Layout.trayScale assumes
  var TRAY_GAP = 8;            // gap (px) between tray pieces at scale 1: the gap Layout.trayScale assumes
  var LIFT_PX = 40;            // a dragged piece floats this far above the finger (design 2.3)
  var TAP_PX = C.Pointer.TAP_MOVE_PX;   // a press that moves less than this only selects
  var BUBBLE_MS = 1600;
  var START_BUBBLE_MS = 2000;
  var BUBBLE_FADE_MS = 250;    // core/effects.js bubble fade-out
  var REACT_MS = 1600;         // the chosen character goes back to normal after a reaction
  var DONE_DOT = 6;            // canvas px per dot of the picture on the done screen
  var MAX_DPR = 3;
  var FRAME_PX = 8;            // the board frame's border on both sides (css .fl-boardframe) and a little air
  var CARD_DOT = 4;            // canvas px per dot on the zukan cards

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
  function inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  function sizeOf(cells) {
    var w = 0, h = 0;
    cells.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    return { w: w, h: h };
  }
  function dprNow() { return Math.min(MAX_DPR, window.devicePixelRatio || 1); }
  function sizeCanvas(cv, w, h, dpr) {
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }

  // deps: { bus, loop, linePicker?, rng? }. Returns { step(ms), destroy() }.
  function init(root, controller, deps) {
    var d = deps || {};
    var bus = d.bus, loop = d.loop;
    if (!bus || typeof bus.on !== 'function') { throw new Error('fill UI.init: deps.bus (EventBus) is required'); }
    if (!loop || typeof loop.start !== 'function') { throw new Error('fill UI.init: deps.loop (core Loop) is required'); }
    var linePicker = d.linePicker || null;
    var rng = d.rng || Math.random;
    var reactions = G.Reactions.create(rng);
    var game = null;          // per-picture view state (see beginPlay)
    var timers = [];
    var detachDrag = null;

    var zukanScreen = el('main', 'screen fl-zukan-screen');
    zukanScreen.id = 'screen-zukan';
    var gameScreen = el('main', 'screen fl-game-screen');
    gameScreen.id = 'screen-game';
    gameScreen.hidden = true;
    root.appendChild(zukanScreen);
    root.appendChild(gameScreen);

    var header = C.UI.header({
      title: 'ピタうめっち',
      soundOn: Sound.isEnabled(),
      onBack: onBack,
      onSound: function () { return Sound.toggleFromTap(); },
      onSettings: openMenu
    });
    // ヒント sits in the header, left of おと (design 4.4); only on the play screen.
    var hintBtn = button('hdr-btn fl-hint', undefined, onHint);
    hintBtn.setAttribute('aria-label', 'ヒント');
    hintBtn.appendChild(el('span', 'hdr-ico', '★'));
    hintBtn.appendChild(el('span', 'hdr-label', 'ヒント'));
    hintBtn.hidden = true;
    header.insertBefore(hintBtn, header.querySelector('.hdr-sound'));
    var titleEl = header.querySelector('.hdr-title');
    document.body.insertBefore(header, document.body.firstChild);

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function sfx(name) { if (game) { Sound.play(name); } }
    function playing() { return !!game && controller.phase() === 'play'; }

    // ---------- zukan screen ----------

    function panel(cls) {
      var p = el('section', 'fl-panel ' + (cls || ''));
      zukanScreen.appendChild(p);
      return p;
    }
    function saveSetting(k, v) {
      var s = controller.loadSettings();
      s[k] = v;
      controller.saveSettings(s);
      renderZukan();
    }

    // A card canvas: the coloured picture when done, otherwise the frame's grey shadow (design 4.3).
    function cardCanvas(item) {
      var pic = item.picture;
      var cv = el('canvas', 'fl-cardcanvas');
      cv.width = pic.pixels[0].length * CARD_DOT;
      cv.height = pic.pixels.length * CARD_DOT;
      var ctx = cv.getContext('2d');
      if (item.done) { R.picture(ctx, pic, CARD_DOT); } else { R.shadow(ctx, G.Puzzle.frameOf(pic), K.DOTS_PER_CELL * CARD_DOT); }
      return cv;
    }

    function renderZukan() {
      var s = controller.loadSettings();
      zukanScreen.innerHTML = '';

      var p1 = panel('fl-charpanel');
      var list = el('div', 'fl-charlist');
      C.Characters.list().forEach(function (pf) {
        var b = button('fl-charbtn', undefined, function () { saveSetting('char', pf.id); });
        b.setAttribute('aria-pressed', String(s.char === pf.id));
        b.setAttribute('aria-label', pf.name);
        var face = el('span', 'fl-charface');
        faceInto(face, pf, 'normal');
        b.appendChild(face);
        list.appendChild(b);
      });
      p1.appendChild(list);

      var p2 = panel('fl-pagepanel');
      var tabs = el('div', 'fl-tabs');
      LEVELS.forEach(function (it) {
        var b = button('fl-tab', it[1], function () { saveSetting('tab', it[0]); });
        b.setAttribute('aria-pressed', String(s.tab === it[0]));
        tabs.appendChild(b);
      });
      p2.appendChild(tabs);

      var items = controller.listOf(s.tab);
      var done = controller.doneCount(s.tab);
      var counts = el('div', 'fl-counts');
      counts.appendChild(el('span', 'fl-count', 'できた ' + done + '／' + items.length));
      counts.appendChild(el('span', 'fl-left', done >= items.length ? 'ぜんぶ できた！' : 'あと ' + (items.length - done) + 'まい'));
      p2.appendChild(counts);

      var grid = el('div', 'fl-cards');
      items.forEach(function (item) {
        var b = button('fl-card' + (item.done ? ' is-done' : '') + (item.sparkle ? ' is-sparkle' : ''), undefined, function () {
          startPicture(item.picture.id);
        });
        b.setAttribute('aria-label', item.done ? item.picture.name : 'まだ');
        var pic = el('span', 'fl-cardpic');
        pic.appendChild(cardCanvas(item));
        if (!item.done) { pic.appendChild(el('span', 'fl-q', '？')); }
        b.appendChild(pic);
        // Not done: the ？ on the shadow is enough; a blank line keeps the cards the same height.
        b.appendChild(el('span', 'fl-cardname', item.done ? item.picture.name : ' '));
        if (item.sparkle) {
          var star = el('span', 'fl-star', '★');
          star.setAttribute('aria-hidden', 'true');
          b.appendChild(star);
        }
        grid.appendChild(b);
      });
      p2.appendChild(grid);

      var p3 = panel('fl-startpanel');
      p3.appendChild(button('btn btn-sub fl-howto', 'あそびかた', showHowTo));
    }

    // The how-to card (design 4.3): the first time the zukan opens, then from the あそびかた button.
    function showHowTo() {
      var pf = profileOf(controller.loadSettings().char);
      var m = null;
      var body = el('div', 'fl-howto-body');
      var face = el('div', 'fl-howto-face');
      faceInto(face, pf, 'joy');
      body.appendChild(face);
      body.appendChild(el('p', 'fl-howto-text', 'ピースを ドラッグして えの とおりの ばしょに はめよう'));
      body.appendChild(el('p', 'fl-howto-text', 'ふつう・むずかしい は まわして むきを あわせよう'));
      body.appendChild(el('p', 'fl-howto-text', 'ぜんぶ はまったら えが できるよ'));
      var acts = el('div', 'fl-menu');
      acts.appendChild(button('btn btn-main', 'わかった', function () { m.close(); controller.markHowToSeen(); }));
      m = C.UI.modal('あそびかた', [body, acts]);
    }

    function showZukan() {
      leaveGame();
      zukanScreen.hidden = false;
      titleEl.textContent = 'ピタうめっち';
      hintBtn.hidden = true;
      renderZukan();
      window.scrollTo(0, 0);
    }

    // ---------- play screen ----------

    function startPicture(id) {
      controller.start(id);
      beginPlay(id);
    }

    function beginPlay(id) {
      clearTimers();
      Fx.stop();
      endDrag();
      var s = controller.loadSettings();
      var nth = 1;
      controller.listOf(pictureOf(id).level).forEach(function (it, i) { if (it.picture.id === id) { nth = i + 1; } });
      game = {
        id: id, profile: profileOf(s.char), cell: 0, dpr: 1, trayCell: TRAY_CELL,
        selected: null, drag: null, hint: null, pop: null, clear: null, reveal: null, clockMs: 0, bubbleUntil: 0, reactToken: 0
      };
      buildGame();
      zukanScreen.hidden = true;
      gameScreen.hidden = false;
      titleEl.textContent = '？ ' + nth + 'まいめ';
      hintBtn.hidden = false;
      document.body.classList.add('fl-playing');
      window.scrollTo(0, 0);
      applyLayout();
      reactions.reset();
      say('start', START_BUBBLE_MS);
      loop.start();
    }
    function pictureOf(id) {
      for (var i = 0; i < G.Pictures.length; i++) { if (G.Pictures[i].id === id) { return G.Pictures[i]; } }
      return null;
    }

    function buildGame() {
      if (detachDrag) { detachDrag(); detachDrag = null; }
      gameScreen.innerHTML = '';
      var wrap = el('div', 'fl-game');

      var boardWrap = el('div', 'fl-boardwrap');
      var frame = el('div', 'fl-boardframe');
      var canvas = el('canvas', 'fl-board');
      frame.appendChild(canvas);
      boardWrap.appendChild(frame);

      var buddy = el('div', 'fl-buddy');
      var faceWrap = el('div', 'fl-facewrap');
      var face = el('div', 'fl-face');
      faceInto(face, game.profile, 'normal');
      var mark = el('span', 'fl-mark');
      mark.setAttribute('aria-hidden', 'true');
      faceWrap.appendChild(face);
      faceWrap.appendChild(mark);
      var sayEl = el('div', 'fl-say');
      buddy.appendChild(faceWrap);
      buddy.appendChild(sayEl);

      var tray = el('div', 'fl-tray');

      var actEl = el('div', 'fl-act');
      game.acts = [];
      if (K.LEVEL[pictureOf(game.id).level].rotate) {   // easy has no rotate button
        game.acts = ACTS.map(function (a) {
          var b = button('fl-actbtn', undefined, function () { turnSelected(); });
          b.dataset.action = a[0];
          b.setAttribute('aria-label', a[2]);
          b.appendChild(el('span', 'fl-ico', a[1]));
          b.appendChild(el('span', 'fl-actlabel', a[2]));
          actEl.appendChild(b);
          return b;
        });
      }

      wrap.appendChild(boardWrap);
      wrap.appendChild(buddy);
      wrap.appendChild(tray);
      actEl.hidden = !game.acts.length;
      wrap.appendChild(actEl);
      gameScreen.appendChild(wrap);

      game.wrap = wrap;
      game.boardWrap = boardWrap;
      game.canvas = canvas;
      game.ctx = canvas.getContext('2d');
      game.face = face;
      game.mark = mark;
      game.say = sayEl;
      game.tray = tray;
      detachDrag = G.Drag.attach(wrap, { pick: pick, onStart: onDragStart, onMove: onDragMove, onEnd: onDragEnd, onCancel: onDragCancel });
    }

    // Board cell size: the largest board that fits its area (design 4.4). Canvas follows devicePixelRatio.
    function applyLayout() {
      if (!game) { return; }
      var frame = controller.puzzle().frame;
      var r = game.boardWrap.getBoundingClientRect();
      game.cell = L.cellSize(r.width - FRAME_PX, r.height - FRAME_PX, frame.w, frame.h);
      game.dpr = dprNow();
      sizeCanvas(game.canvas, game.cell * frame.w, game.cell * frame.h, game.dpr);
      redraw();
      renderTray();
    }

    function pieceOf(id) {
      var ps = controller.puzzle().pieces;
      for (var i = 0; i < ps.length; i++) { if (ps[i].id === id) { return ps[i]; } }
      return null;
    }
    // Placed pieces, each at its answer spot (a placed piece never moves).
    function placedPieces() {
      var e = controller.engine();
      return controller.puzzle().pieces.filter(function (p) { return !!e.state(p.id).at; }).map(function (p) { return { piece: p }; });
    }

    function redraw() {
      if (!game || !game.cell || !controller.engine()) { return; }
      if (game.finished) { return; }
      var ghost = game.drag && game.drag.ghost;
      R.board(game.ctx, {
        frame: controller.puzzle().frame, picture: pictureOf(game.id), guide: K.LEVEL[pictureOf(game.id).level].guide,
        placed: placedPieces(), ghost: ghost || null, hint: game.hint, cell: game.cell, dpr: game.dpr,
        pop: game.pop ? { id: game.pop.id, scale: Fx.popScale(game.pop.t) } : null
      });
      if (game.pop) { game.canvas.setAttribute('data-pop', '1'); } else { game.canvas.removeAttribute('data-pop'); }
      if (ghost) { game.canvas.setAttribute('data-ghost', '1'); } else { game.canvas.removeAttribute('data-ghost'); }
    }

    // The tray (design 4.4): pieces flow left to right at one shared scale so all of them fit (Layout.trayScale).
    function renderTray() {
      if (!game) { return; }
      var e = controller.engine(), tray = game.tray;
      var cs = window.getComputedStyle(tray);
      var w = tray.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 1;
      var h = tray.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 1;
      var ids = e.inTray();
      var shapes = ids.map(function (id) { return e.shape(id); });
      var scale = L.trayScale(w, h, shapes.map(sizeOf));
      var tc = TRAY_CELL * scale;
      game.trayCell = tc;
      tray.innerHTML = '';
      tray.style.gap = (TRAY_GAP * scale) + 'px';
      ids.forEach(function (id, i) {
        var sz = sizeOf(shapes[i]);
        var item = el('div', 'fl-tpiece' + (id === game.selected ? ' is-selected' : '') + (game.hint && game.hint.id === id ? ' is-hint' : ''));
        item.setAttribute('data-piece-id', id);
        if (game.drag && game.drag.moved && game.drag.id === id) { item.style.visibility = 'hidden'; }
        var cv = el('canvas');
        sizeCanvas(cv, sz.w * tc, sz.h * tc, game.dpr);
        item.style.width = (sz.w * tc) + 'px';
        item.style.height = (sz.h * tc) + 'px';
        R.piece(cv.getContext('2d'), pictureOf(game.id), pieceOf(id), e.state(id).rot, tc, game.dpr);
        item.appendChild(cv);
        tray.appendChild(item);
      });
      paintActs();
    }

    // まわす can be pressed only with a selected piece (design 2.3).
    function paintActs() {
      var off = !playing() || !game.selected;
      game.acts.forEach(function (b) { b.disabled = off; });
    }

    function refresh() { redraw(); renderTray(); }

    function select(id) {
      game.selected = id;
      refresh();
    }

    function turnSelected() {
      if (!playing() || !game.selected) { return; }
      sfx('fill-rotate');
      controller.turn(game.selected);
      refresh();
    }

    // ---------- drag (design 2.3) ----------

    // The piece under a pointerdown: a tray piece (its whole box). Placed pieces are locked and cannot be picked.
    function pick(e) {
      if (!playing()) { return null; }
      var t = e.target && e.target.closest ? e.target.closest('[data-piece-id]') : null;
      return t && game.tray.contains(t) ? t.getAttribute('data-piece-id') : null;
    }

    // Remembers where on the piece the finger is (in cells), so the piece keeps that point under the finger.
    function onDragStart(id, e) {
      var tr = game.tray.querySelector('[data-piece-id="' + id + '"]').getBoundingClientRect();
      game.drag = {
        id: id, gx: (e.clientX - tr.left) / game.trayCell, gy: (e.clientY - tr.top) / game.trayCell,
        x0: e.clientX, y0: e.clientY, moved: false, float: null, ghost: null
      };
      select(id);
    }

    function onDragMove(e) {
      var g = game && game.drag;
      if (!g) { return; }
      if (!g.moved) {
        var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (dx * dx + dy * dy < TAP_PX * TAP_PX) { return; }
        g.moved = true;
        g.float = makeFloat(g.id);
        sfx('fill-grab');
        renderTray();
      }
      var left = e.clientX - g.gx * game.cell, top = e.clientY - g.gy * game.cell - LIFT_PX;
      g.float.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      g.ghost = ghostAt(g.id, left, top);
      redraw();
    }

    // The dragged piece at board cell size, following the finger (fixed, never catches the pointer).
    function makeFloat(id) {
      var eng = controller.engine(), sz = sizeOf(eng.shape(id));
      var f = el('div', 'fl-drag');
      var cv = el('canvas');
      sizeCanvas(cv, sz.w * game.cell, sz.h * game.cell, game.dpr);
      R.piece(cv.getContext('2d'), pictureOf(game.id), pieceOf(id), eng.state(id).rot, game.cell, game.dpr);
      f.appendChild(cv);
      gameScreen.appendChild(f);
      return f;
    }

    // Where the piece would snap if let go now (the answer spot): shown only then.
    function ghostAt(id, left, top) {
      var at = L.snap(game.canvas.getBoundingClientRect(), game.cell, left, top);
      var t = controller.engine().snapTarget(id, at.x, at.y);
      if (!t) { return null; }
      return { cells: P.place(pieceOf(id).cells, t.x, t.y), x: t.x, y: t.y };
    }

    function endDrag() {
      if (!game || !game.drag) { return null; }
      var g = game.drag;
      game.drag = null;
      if (g.float && g.float.parentNode) { g.float.parentNode.removeChild(g.float); }
      return g;
    }

    // Let go: on the tray -> stays in the tray; elsewhere -> the engine snaps it to its answer spot or sends it
    // back (design 2.3). A press without a move only selected the piece. A tray piece was never placed.
    function onDragEnd(e) {
      var g = endDrag();
      if (!g) { return; }
      if (!g.moved || !playing()) { refresh(); return; }
      if (!inRect(game.tray.getBoundingClientRect(), e.clientX, e.clientY)) {
        var at = L.snap(game.canvas.getBoundingClientRect(), game.cell,
          e.clientX - g.gx * game.cell, e.clientY - g.gy * game.cell - LIFT_PX);
        controller.drop(g.id, at.x, at.y);
      }
      if (game) { refresh(); }
    }

    // Cancelled (a call, a system gesture): the piece stays in the tray and the shadow goes (Review Focus 5).
    function onDragCancel() {
      if (endDrag()) { refresh(); }
    }

    // ---------- hint (design 2.5) ----------

    function onHint() {
      if (!playing()) { return; }
      controller.hint(rng, game.selected);   // null outside play or with an empty tray; the 'hint' event draws it
    }

    // ---------- character ----------

    // One bubble at a time: a new line waits until the previous one is gone; force replaces it.
    function say(situation, ms, force) {
      if (!linePicker || !game) { return; }
      var now = Date.now();
      if (!force && game.bubbleUntil > now) { return; }
      var text = linePicker.pick(game.profile.id, situation);
      if (!text) { return; }
      var life = ms || BUBBLE_MS;
      C.Effects.bubble(game.say, text, life);
      game.bubbleUntil = now + life + BUBBLE_FADE_MS;
    }

    function react(emotion) {
      var token = ++game.reactToken;
      faceInto(game.face, game.profile, emotion);
      C.Effects.mark(game.mark, C.CharacterView.markOf(emotion));
      later(function () {
        if (!game || game.reactToken !== token) { return; }
        faceInto(game.face, game.profile, 'normal');
        C.Effects.mark(game.mark, null);
      }, REACT_MS);
    }
    function reactTo(r, force) {
      if (!r) { return; }
      react(r.emotion);
      say(r.situation, BUBBLE_MS, force);
    }

    // ---------- clear (design 4.6, 5.2) ----------

    // The picture is complete. Driven by step(): the pieces shine, fade into the dot picture, the name and the
    // cheer come with confetti, then the done screen. Reduced motion: the picture just appears.
    function showFinished() {
      var res = controller.result || {};
      endDrag();
      game.selected = null;
      game.pop = null;
      redraw();
      game.finished = true;
      hintBtn.hidden = true;
      paintActs();
      var reduced = C.Effects.isReduced();
      game.clear = { t: 0, stage: 0, res: res, tl: Fx.timeline(reduced), reduced: reduced };
      if (!reduced) { game.canvas.classList.add('is-glow'); }
      advanceClear(0);
    }

    function advanceClear(ms) {
      var c = game.clear;
      c.t += ms;
      if (c.stage < 1 && c.t >= c.tl.reveal) { c.stage = 1; revealPicture(); }
      if (c.stage < 2 && c.t >= c.tl.cheer) { c.stage = 2; cheer(); }
      if (c.stage < 3 && c.t >= c.tl.done) { c.stage = 3; game.clear = null; showDone(); }
    }

    // The dot picture on a canvas over the board; the pieces fade out under it.
    function paintReveal() {
      var pc = game.reveal, cv = game.canvas;
      pc.width = cv.width; pc.height = cv.height;
      pc.style.width = cv.style.width; pc.style.height = cv.style.height;
      R.picture(pc.getContext('2d'), pictureOf(game.id), game.cell * game.dpr / K.DOTS_PER_CELL);
    }
    function revealPicture() {
      game.reveal = el('canvas', 'fl-reveal' + (game.clear.reduced ? ' is-still' : ''));
      game.canvas.parentNode.appendChild(game.reveal);
      paintReveal();
      game.canvas.classList.remove('is-glow');
      if (game.clear.reduced) { game.canvas.style.visibility = 'hidden'; } else { game.canvas.classList.add('is-fade'); }
    }

    function cheer() {
      var res = game.clear.res;
      titleEl.textContent = pictureOf(game.id).name;
      reactTo(reactions.forClear(!!res.sparkle, !!res.pageDone), true);
      Fx.confetti();
      if (res.sparkleNew) {
        var r = game.canvas.getBoundingClientRect();
        Fx.sparkle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
    }

    function showDone() {
      var res = controller.result || {};
      var pic = pictureOf(game.id);
      var level = '';
      LEVELS.forEach(function (it) { if (it[0] === pic.level) { level = it[1]; } });
      var over = el('div', 'fl-done');
      var card = el('div', 'fl-done-card');
      var cv = el('canvas', 'fl-done-pic');
      cv.width = pic.pixels[0].length * DONE_DOT;
      cv.height = pic.pixels.length * DONE_DOT;
      R.picture(cv.getContext('2d'), pic, DONE_DOT);
      card.appendChild(cv);
      card.appendChild(el('p', 'fl-done-title', pic.name + ' が できた！'));
      card.appendChild(el('p', 'fl-done-sub', 'ずかんに はったよ'));
      if (res.sparkleNew) { card.appendChild(el('p', 'fl-done-extra is-sparkle', 'キラキラ ゲット！')); }
      if (res.pageDone) { card.appendChild(el('p', 'fl-done-extra', level + ' ぜんぶ できた！')); }
      var acts = el('div', 'fl-done-actions');
      var next = button('btn btn-main fl-next', 'つぎの え', onNext);
      acts.appendChild(next);
      acts.appendChild(button('btn btn-sub fl-tozukan', 'ずかんに もどる', showZukan));
      card.appendChild(acts);
      over.appendChild(card);
      gameScreen.appendChild(over);
      if (res.sparkleNew) { sfx('fill-sparkle'); }
      next.focus();
    }

    function onNext() {
      var id = null;
      try { id = controller.nextPictureId(game.id); } catch (err) { id = null; }
      if (id) { startPicture(id); } else { showZukan(); }
    }

    function startBgm() { if (Sound.isBgmOn()) { Bgm.start(G.Sounds.BGM); } else { Bgm.stop(); } }

    function leaveGame() {
      loop.stop();
      clearTimers();
      Fx.stop();
      endDrag();
      if (detachDrag) { detachDrag(); detachDrag = null; }
      if (controller.phase() !== 'zukan') { controller.quit(); }
      game = null;
      gameScreen.hidden = true;
      gameScreen.innerHTML = '';
      document.body.classList.remove('fl-playing');
    }

    // ---------- header ----------

    function goEntry() {
      leaveGame();
      Bgm.stop();
      location.href = C.CharacterView.basePath() + 'index.html';
    }

    // Play: no piece placed -> straight to the zukan; otherwise ask first (design 4.5).
    function onBack() {
      if (!game) { goEntry(); return; }
      if (!controller.needsQuitConfirm()) { showZukan(); return; }
      var m = null;
      var acts = el('div', 'fl-menu');
      acts.appendChild(button('btn btn-main', 'やめる', function () { m.close(); showZukan(); }));
      acts.appendChild(button('btn btn-sub', 'つづける', function () { m.close(); }));
      m = C.UI.modal('やめる？', [acts]);
    }

    // せってい: さいしょから (same picture, new split) on the play screen, and BGM ON/OFF (design 4.5).
    function openMenu() {
      var nodes = [];
      var m = null;
      if (playing()) {
        var acts = el('div', 'fl-menu');
        acts.appendChild(button('btn btn-main', 'さいしょから', function () {
          m.close();
          var id = game.id;
          controller.restart();
          beginPlay(id);
        }));
        nodes.push(acts);
      }
      var row = el('div', 'fl-rule');
      row.appendChild(el('span', 'fl-rulename', 'BGM'));
      var opts = el('div', 'fl-choices');
      [[true, 'ON'], [false, 'OFF']].forEach(function (it) {
        var b = button('fl-choice', it[1], function () {
          Sound.setBgmOn(it[0]);
          startBgm();
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

    on('placed', function (p) {
      sfx('fill-place');
      if (game.hint && game.hint.id === p.id) { game.hint = null; }
      game.selected = null;   // a placed piece is locked: nothing left to turn
      refresh();
      if (!C.Effects.isReduced()) { game.pop = { id: p.id, t: 0 }; }
      reactTo(reactions.forPlaced());
    });
    on('returned', function () { sfx('fill-return'); });
    on('last', function () { reactTo(reactions.forLast(), true); });
    on('hint', function (h) {
      if (!h) { return; }
      game.hint = { id: h.id, cells: h.cells, until: game.clockMs + K.HINT_MS };
      sfx('fill-hint');
      reactTo(reactions.forHint(), true);
      refresh();
    });
    on('clear', function () { sfx('fill-clear'); });
    on('done', showFinished);

    // Core Loop stops itself while the page is hidden; restart it on return while a picture is open.
    function onVisible() { if (!document.hidden && game) { loop.start(); } }
    document.addEventListener('visibilitychange', onVisible);
    function onResize() { applyLayout(); if (game && game.reveal) { paintReveal(); } }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    showZukan();
    startBgm();
    if (controller.needsHowTo()) { showHowTo(); }

    return {
      // Moves the hint clock: the hint shadow goes after HINT_MS (design 2.5).
      step: function (ms) {
        if (!game) { return; }
        game.clockMs += ms || 0;
        if (game.hint && game.clockMs >= game.hint.until) { game.hint = null; refresh(); }
        if (game.pop) {
          game.pop.t += ms || 0;
          if (game.pop.t >= Fx.POP_MS) { game.pop = null; }
          redraw();
        }
        if (game.clear) { advanceClear(ms || 0); }
      },
      // Tests: removes the UI, its header and listeners.
      destroy: function () {
        leaveGame();
        Bgm.stop();
        offs.forEach(function (off) { if (typeof off === 'function') { off(); } });
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (header.parentNode) { header.parentNode.removeChild(header); }
        root.removeChild(zukanScreen);
        root.removeChild(gameScreen);
      }
    };
  }

  G.UI = { init: init, LIFT_PX: LIFT_PX };
})(Ailand.games.fill);
