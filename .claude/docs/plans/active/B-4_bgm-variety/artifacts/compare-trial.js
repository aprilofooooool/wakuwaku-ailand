// B-4 Task 3: checks that the four shipped BGM scores match the approved trial page note for note.
// Run from the repo root: node .claude/docs/plans/active/B-4_bgm-variety/artifacts/compare-trial.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = process.cwd();
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }

// 1) Trial songs: run the page script with its SONGS exposed and the UI part cut off.
var html = read('.claude/docs/specs/bgm-drafts/bgm-trial.html');
var js = html.split('<script>')[1].split('</script>')[0];
js = js.replace('var SONGS = [top, drop4, othello, whack];', 'var SONGS = [top, drop4, othello, whack]; globalThis.TRIAL = SONGS; return;');
var trialBox = {};
vm.runInNewContext(js, trialBox);
var trial = trialBox.TRIAL;

// 2) Shipped scores: load the four files with stubs for the parts they touch at load time.
var shipBox = {
  Ailand: { core: { Sound: { note: function () {}, seq: function () {}, register: function () {} } },
    games: { drop4: {}, othello: {}, whack: {} } }
};
shipBox.window = shipBox;
['js/top-bgm.js', 'games/drop4/js/sounds.js', 'games/othello/js/audio/othello-bgm.js', 'games/whack/js/sounds.js']
  .forEach(function (p) { vm.runInNewContext(read(p), shipBox); });
var A = shipBox.Ailand;
var ship = [
  { sc: A.top.BGM_SCORE },
  { sc: A.games.drop4.Sounds.NORMAL, end: A.games.drop4.Sounds.ENDGAME_BPM },
  { sc: A.games.othello.BGM_SCORE },
  { sc: A.games.whack.Sounds.BGM, end: A.games.whack.Sounds.FINAL_BPM }
];

var problems = [];
function same(a, b) { return Math.abs(a - b) <= 0.01 + 1e-9; }
function pitchEq(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(function (x, i) { return same(x, b[i]); });
  }
  if (typeof a === 'string' || typeof b === 'string') { return a === b; }
  return same(a || 0, b || 0);
}
function voice(name, title, t, s) {
  t = t || []; s = s || [];
  if (t.length !== s.length) { problems.push(title + ' ' + name + ': length ' + t.length + ' vs ' + s.length); return; }
  for (var i = 0; i < t.length; i++) {
    if (!pitchEq(t[i][0], s[i][0]) || t[i][1] !== s[i][1]) {
      problems.push(title + ' ' + name + '[' + i + ']: ' + JSON.stringify(t[i]) + ' vs ' + JSON.stringify(s[i]));
    }
  }
}
trial.forEach(function (t, i) {
  var s = ship[i].sc;
  ['steps', 'bass', 'chords', 'drums'].forEach(function (v) { voice(v, t.title, t[v], s[v]); });
  var want = {
    bpm: t.bpm, wave: t.wave, gate: t.gate, bassWave: t.bassWave, chordWave: t.chordWave, chordLen: t.chordLen,
    bend: t.bend, sparkle: t.sparkle, swing: t.swing, melodyPeak: Math.round(0.32 * t.level / 0.4 * 1000) / 1000
  };
  Object.keys(want).forEach(function (k) {
    if (want[k] !== s[k]) { problems.push(t.title + ' ' + k + ': ' + want[k] + ' vs ' + s[k]); }
  });
  if ((t.endBpm || undefined) !== ship[i].end) { problems.push(t.title + ' endBpm: ' + t.endBpm + ' vs ' + ship[i].end); }
});

if (problems.length) {
  console.log('MISMATCH ' + problems.length);
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('OK: 4 scores match the trial');
