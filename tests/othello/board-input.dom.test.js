(function (O) {
  'use strict';
  // Browser only: real Pointer Events on a small board.

  function makeBoard() {
    var board = document.createElement('div');
    board.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;display:grid;grid-template-columns:1fr 1fr;z-index:9999';
    for (var i = 0; i < 4; i += 1) {
      var c = document.createElement('button');
      c.className = 'cell';
      c.dataset.index = String(i);
      board.appendChild(c);
    }
    document.body.appendChild(board);
    return board;
  }
  function pointer(el, type, x, y) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
  }

  describe('Othello board input (browser)', function () {
    it('cell tap places once', function () {
      var board = makeBoard();
      var got = [];
      try {
        O.UI._attachBoardInput(board, function (cell) { got.push(cell.dataset.index); });
        var cell = board.children[3];
        var r = cell.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        pointer(cell, 'pointerdown', x, y);
        pointer(cell, 'pointerup', x + 5, y + 5); // a small slip is still a tap
        expect(got).toEqual(['3']);
        cell.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); // the click after a tap
        expect(got).toEqual(['3']);
        cell.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })); // keyboard Enter
        expect(got).toEqual(['3', '3']);
        pointer(cell, 'pointerdown', x, y);
        pointer(cell, 'pointerup', x + 30, y); // a drag is not a tap
        expect(got).toEqual(['3', '3']);
      } finally { board.remove(); }
    });
  });
})(Ailand.games.othello);
