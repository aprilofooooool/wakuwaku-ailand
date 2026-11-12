(function (O) {
  'use strict';
  // Browser only: these tests trigger intentional 404s for missing images (test page only).
  var CM = O.CharacterManager;

  function cloneWithDir(char, dir) {
    var c = JSON.parse(JSON.stringify(char));
    c.image.dir = dir;
    return c;
  }

  // Resolves once check() is truthy, or rejects after timeoutMs.
  function waitFor(check, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function poll() {
        if (check()) { resolve(); return; }
        if (Date.now() - start > timeoutMs) { reject(new Error('timeout')); return; }
        setTimeout(poll, 30);
      })();
    });
  }

  function host() {
    var el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  }

  describe('CharacterManager.applyImage (browser)', function () {
    it('all images missing: falls back to the CSS disc', async function () {
      var el = host();
      var c = cloneWithDir(CM.list()[0], 'no-such-dir/');
      CM.applyImage(el, c, 'joy', 'avatar');
      await waitFor(function () { return el.querySelector('.css-disc'); }, 3000);
      expect(el.querySelector('img')).toBe(null);
      expect(el.textContent).toContain(c.face.joy);
      el.remove();
    });
    it('emotion image missing but normal exists: the normal <img> stays', async function () {
      var el = host();
      // tests/ is one level below the app root, so point the dir at the real assets.
      var c = cloneWithDir(CM.list()[0], '../assets/characters/mametchi/');
      CM.applyImage(el, c, 'no-such-emotion', 'avatar');
      await waitFor(function () {
        var img = el.querySelector('img');
        return img && /normal\.png$/.test(img.getAttribute('src')) && img.complete && img.naturalWidth > 0;
      }, 3000);
      expect(el.querySelector('.css-disc')).toBe(null);
      el.remove();
    });
  });
  describe('UI char panel mark (browser, B-3)', function () {
    function panel() {
      var c = cloneWithDir(CM.list()[0], '../assets/characters/mametchi/');
      var pn = O.UI._makeCharPanel('p1', c, '1P');
      document.body.appendChild(pn.root);
      return pn;
    }
    it('panel has a mark slot', function () {
      var pn = panel();
      expect(pn.root.querySelectorAll('.panel-mark').length).toBe(1);
      expect(pn.mark.getAttribute('aria-hidden')).toBe('true');
      pn.root.remove();
    });
    it('sleep shows zzz and normal clears it', function () {
      var pn = panel();
      O.UI._setAvatar(pn, 'sleep');
      expect(pn.mark.textContent).toBe(Ailand.core.Effects.glyph('zzz'));
      O.UI._setAvatar(pn, 'normal');
      expect(pn.mark.textContent).toBe('');
      pn.root.remove();
    });
  });
})(Ailand.games.othello);
