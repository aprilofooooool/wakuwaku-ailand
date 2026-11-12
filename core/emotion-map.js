(function (C) {
  'use strict';

  // Requirements 1.5. When an image is added, rewrite the `image` of its row only.
  // mark: null | 'sweat' | 'bang' | 'sparkle' | 'zzz' | 'steam' | 'smirk' | 'cheer' | 'love'
  var TABLE = {
    'normal': { image: 'normal', mark: null },
    'joy': { image: 'joy', mark: null },
    'anger': { image: 'anger', mark: null },
    'sadness': { image: 'sadness', mark: null },
    'panic': { image: 'panic', mark: null },
    'thinking': { image: 'thinking', mark: null },
    'worried': { image: 'worried', mark: null },
    'surprised': { image: 'surprised', mark: null },
    'excited': { image: 'excited', mark: null },
    'sleep': { image: 'sleep', mark: 'zzz' },
    'angry-steam': { image: 'anger', mark: 'steam' },
    'smug': { image: 'smug', mark: null },
    'cheer': { image: 'cheer', mark: null },
    'love': { image: 'love', mark: null }
  };

  function resolve(logical) {
    var row = Object.prototype.hasOwnProperty.call(TABLE, logical) ? TABLE[logical] : null;
    return row ? { image: row.image, mark: row.mark } : { image: 'normal', mark: null };
  }

  C.EmotionMap = { resolve: resolve, LOGICAL: Object.keys(TABLE) };
})(Ailand.core);
