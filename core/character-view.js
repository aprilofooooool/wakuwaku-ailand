(function (C) {
  'use strict';
  // Image candidates + CSS fallback for a character. DOM is touched only in apply / renderFallback.

  function basePath() {
    if (typeof document === 'undefined' || !document.documentElement || !document.documentElement.dataset) { return ''; }
    return document.documentElement.dataset.base || '';
  }

  function candidates(profile, logical) {
    var image = C.EmotionMap.resolve(logical).image;
    var names = image === 'normal' ? ['normal'] : [image, 'normal'];
    var base = basePath();
    return names.map(function (n) { return base + profile.image.dir + n + '.' + profile.image.ext; });
  }

  function markOf(logical) {
    return C.EmotionMap.resolve(logical).mark;
  }

  // Colored circle with the face for the resolved image and the first letter of the name.
  function renderFallback(el, profile, logical) {
    var image = C.EmotionMap.resolve(logical).image;
    var doc = el.ownerDocument;
    el.innerHTML = '';
    var disc = doc.createElement('div');
    disc.className = 'css-disc';
    disc.style.backgroundColor = profile.colors.main;
    disc.style.borderColor = profile.colors.sub;
    var face = doc.createElement('span');
    face.className = 'css-disc-face';
    face.textContent = profile.face[image] || profile.face.normal;
    var initial = doc.createElement('span');
    initial.className = 'css-disc-initial';
    initial.textContent = Array.from(profile.name)[0];
    disc.appendChild(face);
    disc.appendChild(initial);
    el.appendChild(disc);
  }

  // Walks the candidates on error; the CSS circle is the last resort.
  function apply(imgEl, profile, logical) {
    var list = candidates(profile, logical);
    var i = 0;
    imgEl.alt = profile.name;
    imgEl.onerror = function () {
      i += 1;
      if (i < list.length) {
        imgEl.src = list[i];
      } else {
        imgEl.onerror = null;
        var parent = imgEl.parentNode;
        if (parent) { renderFallback(parent, profile, logical); }
      }
    };
    imgEl.src = list[0];
  }

  C.CharacterView = {
    basePath: basePath,
    candidates: candidates,
    apply: apply,
    renderFallback: renderFallback,
    markOf: markOf
  };
})(Ailand.core);
