(function () {
  'use strict';
  // Browser only: needs a DOM.
  var U = Ailand.core.UI;

  describe('core/UI (dom)', function () {
    it('header has 3 labelled buttons of at least 64px', function () {
      var calls = [];
      var h = U.header({
        title: 'test',
        onBack: function () { calls.push('back'); },
        onSound: function () { calls.push('sound'); return false; },
        onSettings: function () { calls.push('settings'); },
        soundOn: true
      });
      document.body.appendChild(h);
      var btns = h.querySelectorAll('button');
      expect(btns.length).toBe(3);
      Array.prototype.forEach.call(btns, function (b) {
        expect(!!b.getAttribute('aria-label')).toBe(true);
        var r = b.getBoundingClientRect();
        expect(r.width >= 64 && r.height >= 64).toBe(true);
        b.click();
      });
      expect(calls).toEqual(['back', 'sound', 'settings']);
      document.body.removeChild(h);
    });
    it('header repaints on Sound.onChange', function () {
      var S = Ailand.core.Sound;
      var h = U.header({ title: 't', soundOn: true });
      document.body.appendChild(h);
      var b = h.querySelector('.hdr-sound');
      try {
        S.setEnabled(false);
        expect(b.getAttribute('aria-pressed')).toBe('false');
        S.setEnabled(true);
        expect(b.getAttribute('aria-pressed')).toBe('true');
      } finally { S.setEnabled(true); document.body.removeChild(h); }
    });
    it('modal closes and toast appears', function () {
      var m = U.modal('t', [document.createElement('p')]);
      expect(document.querySelectorAll('.modal-back').length > 0).toBe(true);
      m.close();
      expect(document.querySelectorAll('.modal-back').length).toBe(0);
      U.toast('hi', 10);
      expect(document.querySelectorAll('.toast').length).toBe(1);
    });
  });
})();
