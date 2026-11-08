(function () {
  'use strict';
  var C = Ailand.core;

  describe('core/EventBus', function () {
    it('delivers payload to handlers and off() unsubscribes', function () {
      var bus = C.EventBus.create();
      var got = [];
      var off = bus.on('a', function (p) { got.push(p); });
      bus.emit('a', 1);
      off();
      bus.emit('a', 2);
      expect(got).toEqual([1]);
    });
    it('buses are independent', function () {
      var b1 = C.EventBus.create();
      var b2 = C.EventBus.create();
      var n = 0;
      b1.on('a', function () { n++; });
      b2.emit('a');
      expect(n).toBe(0);
    });
    it('emit with no handlers does not throw', function () {
      C.EventBus.create().emit('none', 1);
    });
  });
})();
