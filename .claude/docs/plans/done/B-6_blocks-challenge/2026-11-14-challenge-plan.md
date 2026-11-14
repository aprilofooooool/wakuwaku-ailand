# おちブロック きろくチャレンジとボタンの並び Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the touch buttons to ← ↓ hard ↻ →, and add a second play mode, きろくチャレンジ: no goal, no time limit, score = own faces collected, ends only when blocked, best score saved per difficulty.

**Architecture:** The mode lives in the engine state (`game.mode`, `game.best`), so the engine skips the goal, the clock and time bonuses, and emits a new `record` event. The controller stores `mode` in `settings.v1` and the best scores in `best.v1`, the same shape as whack (`games/whack/js/controller.js:5,30-34`). The UI reads the mode and events only.

**Tech Stack:** Vanilla ES5 IIFE on `window.Ailand`, Canvas 2D, Web Audio, Node vm test runner.

**Spec:** `.claude/docs/specs/2026-11-14-blocks-challenge-design.md`. It adds to `.claude/docs/specs/2026-11-14-blocks-design.md` and `.claude/docs/specs/2026-11-14-blocks-thrill-design.md`, and changes only what it says.

## Global Constraints

- ES5 only (`var`, `function`, no arrow functions or modules). Each file is one IIFE on `Ailand.games.blocks`.
- Tests: `scripts\run.bat test` runs the Node tests and the static check. Expected: 0 failures and 0 violations. Browser-only tests (`*.dom.test.js`) run in `tests/test.html`; the controller runs them, not the implementer.
- The collect mode (かおあつめ) must behave exactly as now: every existing test keeps passing without changing its assertions (except the button-order test in Task 1).
- Mode values: `'collect'` | `'challenge'`. Default and fallback `'collect'`.
- Storage: `settings.v1` gains `mode`. Best scores: key `best.v1`, value `{ easy: n, normal: n, hard: n }`. A missing, non-number or ≤ 0 entry reads as 0.
- `ALMOST` (3) is reused for the challenge "もうすこし".
- Lines are original text, at most 20 characters, always upbeat, unique per character, in each character's voice (header comment of `lines.js`). Challenge lines must not contain `ゴール` or `クリア`.
- Never stop processes by name. Stop only PIDs you started.
- Commit messages: `<type>: <要約>` (要約 in Japanese). End every commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `.claude/launch.json` is the user's. Do not stage or commit it.

## Decisions this plan makes (spec left them open)

- **Engine fields in challenge:** `game.mode = 'challenge'`, `game.goal = null`, `game.timeMs = null`, `game.best` = the best passed at create (≥ 0 integer). In collect: `game.mode = 'collect'`, `game.best = 0`, goal and timeMs as now.
- **Record event:** `{ type: 'record', collected, viaStar }`. Emitted at most once per round, right after the `clear` (and its `time`, collect only) or the `star` event whose collect first makes `collected > best`, only when `best > 0`. `viaStar` is true when it came from the star wave.
- **Almost in challenge:** same `checkAlmost` with the target `best` instead of `goal`; never true when `best === 0`. A collect that jumps past the best uses it up silently (the existing `left > 0` rule does this).
- **Saving on the fly:** after every `handle(events)`, if the mode is challenge and `game.collected` > the stored best for the difficulty, the controller writes it at once.
- **Result:** `getResult()` adds `mode`, `best`, `newRecord`. Challenge: `newRecord = collected >= 1 && collected > startBest`; `best = max(startBest, collected)`. Collect: `newRecord = false`, `best = 0`.
- **Button groups:** `PADS.move` = left, soft, hard; `PADS.act` = rotate, right. Portrait shows one row (move then act); landscape keeps the two groups left and right of the board.
- **Star + record in one moment:** banner and sound stay the star's; the bubble shows the record line (UI uses `viaStar`).

## Review Focus

1. **Collect mode drifts**: a challenge-mode branch leaks into collect (clock hidden, time bonus missing, goal ignored). Expected: no change. Pinned by the existing tests plus a Task 2 test that `create` without `mode` gives collect.
2. **Best score lost on quit**: the player beats the record and leaves via せってい or もどる before stacking up. Expected: the new best is already in `best.v1`. Pinned in Task 3.
3. **Broken storage value**: `best.v1` holds a string, a negative or `null`. Expected: read as 0, no crash, overwritten by the first score ≥ 1. Pinned in Task 3.
4. **Second round after a record**: もういっかい after a new record. Expected: the new round compares against the new best (record event only when beating it again). Pinned in Task 3.
5. **Challenge never times out during a long settle chain**: Expected: `step` never ends a challenge round except by `blocked`. Pinned in Task 2.

---

### Task 1: Button order

**Files:**
- Modify: `games/blocks/js/ui.js:8-11` (`PADS`), `games/blocks/css/blocks.css:107-128` (flex ratios, landscape comment)
- Test: `tests/blocks/ui.dom.test.js`

**Interfaces:** Produces `PADS.move = left, soft, hard` and `PADS.act = rotate, right`; button labels and `data-action` values unchanged.

- [ ] **Step 1:** Add a ui.dom test `it('pad buttons run ← ↓ hard ↻ → left to right')`: the `data-action` values of `.bl-pad button` in DOM order equal `['left', 'soft', 'hard', 'rotate', 'right']`.
- [ ] **Step 2:** Change `PADS`. In CSS swap the flex ratios so `.bl-pad-move` is `3 1 0` and `.bl-pad-act` is `2 1 0`, and update the landscape comment to "← ↓ hard under the left side, ↻ → under the right side".
- [ ] **Step 3:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations. Report that the new ui.dom test needs the browser run.
- [ ] **Step 4:** Commit: `feat: おちブロックの操作ボタンを ← ↓ いっき ↻ → の順にする`

### Task 2: Challenge mode in the engine

**Files:**
- Modify: `games/blocks/js/engine.js` (`create`, `checkAlmost`, `startClear`, `startStar`, `endSettle`, `finishSettle`, `step`)
- Test: `tests/blocks/engine.test.js`

**Interfaces:**
- Consumes: `E.create(opts)` gains `opts.mode` (`'collect'` default) and `opts.best` (number, default 0; non-number or < 0 → 0).
- Produces: `game.mode`, `game.best`, `game.goal === null` and `game.timeMs === null` in challenge; the `record` event above.

- [ ] **Step 1: Write failing tests** in a new `describe('blocks engine challenge')`, using `E.create({ difficulty: 'normal', selfId: 'mametchi', seed: 1, mode: 'challenge', best: B })`:
  - `create` without `mode` gives `mode === 'collect'`, `goal === 30`, `timeMs === 150000`, `best === 0`.
  - Challenge: `goal === null`, `timeMs === null`. `E.step(g, 600000)` while falling leaves `timeMs === null` and never emits `over` with `timeup`.
  - A clear with own faces emits no `time` event; `collected` grows by the own faces; after the settle the state is `falling` (never `goal`) even with `collected` 999.
  - A star clear: the `star` event comes with no `time` event; the faces are counted.
  - Locking into the hidden rows gives `over` with `reason: 'blocked'`.
  - `best: 5`, `collected = 4`, a clear with 2 own faces: events in order `clear`, `record` with `{ collected: 6, viaStar: false }`; a second such clear emits no `record`.
  - `best: 5`, `collected = 1`, a clear with 1 own face: `clear.almost === true`. With `collected = 1` and a clear with 5 own faces: `almost === false` and a `record` follows.
  - `best: 0`: a clear with 3 own faces gives `almost === false` and no `record`.
  - A record from a star wave has `viaStar: true` and comes after the `star` event.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement. Keep every collect path identical: guard goal checks with `game.goal !== null`, skip time decrement, timeup and `time` events when `game.timeMs === null`, and add a `checkRecord(game, viaStar)` helper that returns `[]` or `[recordEvent]`, called after `checkAlmost` in `startClear` and `startStar`.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックのエンジンにきろくチャレンジを足す`

### Task 3: Controller — mode setting and best scores

**Files:**
- Modify: `games/blocks/js/controller.js`
- Test: `tests/blocks/controller.test.js`

**Interfaces:**
- Consumes: Task 2 `E.create` opts and `game.mode`.
- Produces:
  - `loadSettings()` returns `{ char, difficulty, mode, seenHowTo }`; `start(s)` accepts `s.mode`.
  - `controller.bestOf(difficulty) -> number` (≥ 0 integer).
  - `getResult()` adds `mode`, `best`, `newRecord`.
  - `BEST_KEY = 'best.v1'` exported on `G.Controller`.

- [ ] **Step 1: Write failing tests:**
  - `loadSettings()` with no storage gives `mode: 'collect'`; with `settings.v1.mode = 'x'` gives `'collect'`; `start({ ..., mode: 'challenge' })` saves `mode: 'challenge'` into `settings.v1`.
  - `bestOf('easy')` is 0 for each of: no `best.v1`, `best.v1 = 'x'`, `{ easy: -3 }`, `{ easy: '7' }`; is 7 for `{ easy: 7 }`.
  - Challenge with `best.v1 = { easy: 2 }`: make the game collect 3 (set `game().collected = 2` then clear a row holding one own face, or drive `handle` through a lock). Right after that `advance`, before any over, `storage.m['best.v1'].easy === 3` and `normal`/`hard` entries are untouched.
  - Then `quit()`: `best.v1.easy` stays 3.
  - Blocked end in challenge with start best 2 and collected 3: `getResult()` gives `{ mode: 'challenge', newRecord: true, best: 3, cleared: false, timeup: false }`. With start best 5 and collected 3: `newRecord: false, best: 5`.
  - Start best 0, collected 1 at blocked end: `newRecord: true`. Collected 0: `newRecord: false`.
  - もういっかい: after a round that saved 3, `start` again in challenge passes `best: 3` to the engine (`game().best === 3`).
  - Collect mode never writes `best.v1`.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement: `validMode`, `mode` in `defaults`/`load`/`save`/`start`; `bestOf` like whack; keep `startBest` per round; write the best in `handle` after the events; extend `getResult`.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックの遊び方の設定と最高記録の保存を足す`

### Task 4: Lines, reactions and the record sound

**Files:**
- Modify: `games/blocks/js/lines.js`, `games/blocks/js/reactions.js`, `games/blocks/js/sounds.js`
- Test: `tests/blocks/lines.test.js`, `tests/blocks/reactions.test.js`, and the sound-name test if one lists `blocks-*` names (search `tests/` for `blocks-star`).

**Interfaces:**
- Produces:
  - Line situations `record` (just beat the best, also used on the result card) and `nearRecord` (1–3 left to the best), 3 lines each for all 4 characters.
  - `reactions.forRecord() -> { emotion, situation: 'record' }` from the pool `['excited', 'cheer']`.
  - Sound `blocks-record`: short, bright, distinct from `blocks-goal` and `blocks-star`.

- [ ] **Step 1:** Tests: add `record: 3, nearRecord: 3` to `MIN` in `lines.test.js`; add a test that no `record`/`nearRecord` line contains `ゴール` or `クリア`; add a reactions test that `forRecord()` gives `situation: 'record'` and an emotion in `['excited', 'cheer']`; if a test lists sound names, add `blocks-record`.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Write the lines (Global Constraints apply), `forRecord`, and the sound.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックのしんきろくのセリフ・表情・音を足す`

### Task 5: Screens — settings, how-to, play, result

**Files:**
- Modify: `games/blocks/js/ui.js`, `games/blocks/css/blocks.css`
- Test: `tests/blocks/ui.dom.test.js`

**Interfaces:**
- Consumes: Task 3 `loadSettings().mode`, `start(s)` with `mode`, `bestOf`, `getResult()` fields; Task 2 `record` event and `game.mode`/`game.best`; Task 4 lines `record`/`nearRecord`, `forRecord`, `blocks-record`.

- [ ] **Step 1: Write failing ui.dom tests:**
  - Settings shows a panel `あそびかた` with buttons `かおあつめ` and `きろくチャレンジ`; pressing one sets `aria-pressed`. In challenge each level shows `さいこう Nこ` from `best.v1`, or `きろく なし` when 0, and no time text.
  - How-to in challenge contains `じかんは ない`, `つまったら おしまい` and `さいこうきろく`; in collect it is unchanged.
  - Challenge play: the clock (`.bl-clock`) is hidden; the counter reads `★ 0` style text without `／`; with best 0 the `.bl-best` element is hidden; with best 23 it reads `さいこう 23`.
  - Emitting `record` (`viaStar: false`) shows the banner `しんきろく！` and a bubble with a `record` line; with `viaStar: true` no new banner is added but the bubble shows a `record` line.
  - A `clear` with `almost: true` in challenge shows a `nearRecord` line and raises the tempo like collect's almost.
  - Result in challenge with `newRecord: true`: card text `しんきろく！`, the score `★25こ`, a `さいこう 25` line, a `record` line. With `newRecord: false`: `おしまい` and an `over` line.
  - `もういっかい` keeps the mode and difficulty.
- [ ] **Step 2:** Run `scripts\run.bat test` (static check must stay clean). The ui.dom tests are run in the browser by the controller.
- [ ] **Step 3:** Implement:
  - Settings: `MODES = [['collect', 'かおあつめ'], ['challenge', 'きろくチャレンジ']]` panel above むずかしさ; `draft.mode`; level meta by mode.
  - `startGame`/`again` pass `mode`.
  - How-to text by mode.
  - Play: hide the clock and skip `paintClock` work in challenge; counter `★ N`; add `.bl-best` under the counter, hidden when the start best is 0, text `さいこう M` where M = max(start best, `game.shown.star`).
  - `record` handler: when `!viaStar`, `Fx.showBanner('しんきろく！', 'is-go', 900)` and `blocks-record`; always `react(reactions.forRecord().emotion)` and `say('record', BUBBLE_MS, true)`.
  - `showAlmost` uses `nearRecord` in challenge.
  - Result as in spec §4.4: newRecord → `しんきろく！`, `forResult('goal')`, `record` line, `blocks-goal`, confetti; otherwise the existing `おしまい` path. Add the `さいこう M` line in challenge only.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックの画面にきろくチャレンジを足す`

### Task 6: Manual test by the user (not dispatched)

The controller opens `scripts\run.bat serve` → `http://127.0.0.1:8080/games/blocks/index.html`, checks 375×812 and 844×390 fit, then asks the user to test on devices:
- The new button order is easy to use (portrait and landscape).
- Settings: mode choice and best per level are clear.
- Challenge: no clock, `さいこう` shows, もうすこし and しんきろく！ feel exciting, the result shows the record.
- Leaving mid-run keeps the record.
- Collect mode feels unchanged.
- Whether a challenge round runs too long at the floor speed (spec §3.1).
