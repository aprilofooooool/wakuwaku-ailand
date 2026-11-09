(function (O) {
  'use strict';
  // Pure functions are used from Node, so DOM access stays inside applyImage / renderCssDisc.
  // The roster is core/characters.js (array order = select screen order); speech lines are O.Lines.
  var roster = null;
  function list() {
    if (!roster) { roster = Ailand.core.Characters.list(); }
    return roster;
  }

  function get(id) {
    var list_ = list();
    for (var i = 0; i < list_.length; i += 1) {
      if (list_[i].id === id) { return list_[i]; }
    }
    return null;
  }

  // image.dir is relative to the repo root; data-base on <html> points the page there.
  function imagePath(char, name) {
    return Ailand.core.CharacterView.basePath() + char.image.dir + name + '.' + char.image.ext;
  }

  function imageCandidates(char, emotion) {
    var names = emotion === 'normal' ? ['normal'] : [emotion, 'normal'];
    return names.map(function (n) { return imagePath(char, n); });
  }

  // Discs show the normal image.
  function discCandidates(char) {
    return [imagePath(char, 'normal')];
  }

  function isSelectable(id, otherSelectedId) {
    return get(id) !== null && id !== otherSelectedId;
  }

  function pickCpu(excludeId, rng) {
    var random = rng || Math.random;
    var pool = list().filter(function (c) { return c.id !== excludeId; });
    var idx = Math.min(Math.floor(random() * pool.length), pool.length - 1);
    return pool[idx];
  }

  // Human seats keep their pick (invalid or duplicate ids become null); CPU seats take unused characters in roster order.
  function fillSeats(humanIds, humans) {
    var seats = [];
    var used = {};
    var i;
    for (i = 0; i < 4; i += 1) {
      var id = i < humans ? humanIds[i] : null;
      if (i < humans && get(id) !== null && !used[id]) {
        used[id] = true;
        seats.push(id);
      } else {
        seats.push(null);
      }
    }
    var free = list().map(function (c) { return c.id; }).filter(function (cid) { return !used[cid]; });
    for (i = humans; i < 4; i += 1) { seats[i] = free.shift() || null; }
    return seats;
  }

  // Theme-colored circle with the face for the emotion and the first letter of the name.
  function renderCssDisc(el, char, emotion) {
    var doc = el.ownerDocument;
    el.innerHTML = '';
    var disc = doc.createElement('div');
    disc.className = 'css-disc';
    disc.style.backgroundColor = char.colors.main;
    disc.style.borderColor = char.colors.sub;
    var face = doc.createElement('span');
    face.className = 'css-disc-face';
    face.textContent = char.face[emotion] || char.face.normal;
    var initial = doc.createElement('span');
    initial.className = 'css-disc-initial';
    initial.textContent = Array.from(char.name)[0];
    disc.appendChild(face);
    disc.appendChild(initial);
    el.appendChild(disc);
  }

  // Puts an <img> into el and walks the candidates on error; the CSS disc is the last resort.
  function applyImage(el, char, emotion, kind) {
    var candidates = kind === 'disc' ? discCandidates(char) : imageCandidates(char, emotion);
    var doc = el.ownerDocument;
    var img = doc.createElement('img');
    var i = 0;
    img.className = 'char-img';
    img.alt = char.name;
    img.onerror = function () {
      if (img.parentNode !== el) { return; } // replaced by a newer applyImage call
      i += 1;
      if (i < candidates.length) {
        img.src = candidates[i];
      } else {
        img.onerror = null;
        renderCssDisc(el, char, emotion);
      }
    };
    el.innerHTML = '';
    el.appendChild(img);
    img.src = candidates[0];
  }

  O.CharacterManager = {
    list: list,
    get: get,
    imagePath: imagePath,
    imageCandidates: imageCandidates,
    discCandidates: discCandidates,
    isSelectable: isSelectable,
    pickCpu: pickCpu,
    fillSeats: fillSeats,
    applyImage: applyImage,
    renderCssDisc: renderCssDisc
  };
})(Ailand.games.othello);
