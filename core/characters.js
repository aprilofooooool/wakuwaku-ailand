(function (C) {
  'use strict';

  // Common profiles. Speech lines live in each game, not here (requirements 1.4).
  // Array order = display order. Adding a character = adding one entry + an image folder.
  var PROFILES = [
  {
    id: 'mametchi',
    name: 'まめっち',
    colors: {
      main: '#3b7ddd',
      sub: '#cfe2ff'
    },
    image: {
      dir: 'assets/characters/mametchi/',
      ext: 'png'
    },
    face: {
      normal: '(・ω・)',
      joy: '(＾▽＾)',
      anger: '(｀へ´)',
      sadness: '(；ω；)',
      panic: '(°□°;)',
      thinking: '(・ε・)'
    },
    voice: {
      firstPerson: 'ぼく',
      ending: null
    }
  },
  {
    id: 'kuchipatchi',
    name: 'くちぱっち',
    colors: {
      main: '#8fbf2f',
      sub: '#fff1a6'
    },
    image: {
      dir: 'assets/characters/kuchipatchi/',
      ext: 'png'
    },
    face: {
      normal: '(・o・)',
      joy: '(＾o＾)',
      anger: '(｀o´)',
      sadness: '(；o；)',
      panic: '(°o°;)',
      thinking: '(・〜・)'
    },
    voice: {
      firstPerson: 'ぼく',
      ending: 'だっち'
    }
  },
  {
    id: 'mimitchi',
    name: 'みみっち',
    colors: {
      main: '#a879d8',
      sub: '#f6d8f2'
    },
    image: {
      dir: 'assets/characters/mimitchi/',
      ext: 'png'
    },
    face: {
      normal: '(・x・)',
      joy: '(＾x＾)',
      anger: '(｀x´)',
      sadness: '(；x；)',
      panic: '(°x°;)',
      thinking: '(・x・?)'
    },
    voice: {
      firstPerson: 'わたし',
      ending: 'ぴょん'
    }
  },
  {
    id: 'flowertchi',
    name: 'ふらわっち',
    colors: {
      main: '#f2684a',
      sub: '#ffd9c7'
    },
    image: {
      dir: 'assets/characters/flowertchi/',
      ext: 'png'
    },
    face: {
      normal: '(・‿・)',
      joy: '(＾‿＾)',
      anger: '(｀‿´)',
      sadness: '(；_；)',
      panic: '(°_°;)',
      thinking: '(・_・)'
    },
    voice: {
      firstPerson: 'わたし',
      ending: null
    }
  }
];

  function copy(p) { return JSON.parse(JSON.stringify(p)); }

  C.Characters = {
    list: function () { return PROFILES.map(copy); },
    get: function (id) {
      for (var i = 0; i < PROFILES.length; i++) {
        if (PROFILES[i].id === id) { return copy(PROFILES[i]); }
      }
      return null;
    }
  };
})(Ailand.core);
