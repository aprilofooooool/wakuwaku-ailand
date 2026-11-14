# おちブロック 時間の制限とほしブロック Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time limit (timeout = lose, own faces add time), a rare star block that sends every own face on the board flying, and raise the goals to 15/30/50.

**Architecture:** Time and star logic live in `engine.js` (state + `step(ms)`), so pause and countdown need no new code: the controller calls `E.step` only while playing and not paused (`controller.js:85-103`). UI, render, fx and sounds only react to engine events and read `game.timeMs`.

**Tech Stack:** Vanilla ES5 IIFE on `window.Ailand`, Canvas 2D, Web Audio, Node vm test runner.

**Spec:** `.claude/docs/specs/2026-11-14-blocks-thrill-design.md`. It adds to `.claude/docs/specs/2026-11-14-blocks-design.md` and changes only what it says.

## Global Constraints

- ES5 only (`var`, `function`, no arrow functions or modules). Each file is one IIFE on `Ailand.games.blocks`.
- Tests: `scripts\run.bat test` runs the Node tests and the static check. Expected: 0 failures and 0 violations. Browser-only tests are marked `data-browser-only` in `tests/test.html`.
- Never stop processes by name. Stop only PIDs you started.
- Commit messages: `<type>: <要約>` (要約 in Japanese). End every commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Values (spec §2.3), all in `constants.js`:

  | | easy | normal | hard |
  |---|---|---|---|
  | goal | 15 | 30 | 50 |
  | timeMs | 180000 | 150000 | 120000 |
  | faceMs | 3000 | 3000 | 2000 |

  Shared values:
  - `STAR_MS: 15000`
  - `STAR_MIN: 12`, `STAR_MAX: 18`
  - `STAR_SETTLE_MS: 600`
  - `HURRY_MS: 10000`
- Lines are original text, at most 20 characters, always upbeat. Each character keeps their own voice (see the header comment of `lines.js`). After a loss the face goes no lower than `worried`.
- The `.claude/launch.json` file is the user's. Do not stage or commit it.

## Decisions this plan makes (spec left them open)

- **Time additions are a `time` event**, as the spec §4 says: `{ type: 'time', addMs }`.
  - It is emitted right after the `clear` event that earned the time, and right after the `star` event.
  - When a star clear happens, the `time` event carries the star bonus and the face bonus summed.
- **Running out of time**:
  - The timer counts down in both `falling` and `settling`, and stops at a floor of 0.
  - The `timeup` check happens only:
    - in `falling`, at the start of `step`;
    - at the end of a settle, before a spawn.
  - At the end of a settle, a reached goal always wins (spec §2.1).
  - A loss by time ends with `{ type: 'over', reason: 'timeup' }`, and `game.overReason = 'timeup'`. The existing blocked loss becomes `reason: 'blocked'`.
- **Star stored on the piece**:
  - `piece.star` is the index (0–3) into the list `P.cells(shape, rot)`, or `null`.
  - The index stays correct after rotation, because `cells` maps each cell in the same order.
  - A locked star cell is `{ charId, star: true }`.
- **Star timing**:
  - Star rolls use their own rng, `mulberry32(seed ^ 0x5bd1e995)`, so the existing shape and character order for a seed does not change.
  - `_starIn` is set to a random integer in [STAR_MIN, STAR_MAX], drawn from that rng.
  - Every `drawNext` lowers `_starIn` by 1. When it reaches 0, the drawn `next` gets `star = floor(starRng() * 4)`, and `_starIn` is rolled again.
- **Star clear sequence**:
  1. The row clear settles as now.
  2. If a cleared row held a star and the goal is not reached, the engine emits `star` and enters a second settle (`_settle.kind = 'star'`, which lasts `STAR_SETTLE_MS`).
  3. When that settle ends, each own-face cell is removed from its column. The cells above it in that column move down 1, which works like splicing the column array, so other holes keep their shape.
  4. The engine emits `{ type: 'collapse', cells }`.
  5. Then the engine checks for full rows again: a chain goes through the normal `startClear`, otherwise goal, timeup or spawn.
  6. Any stars left on the board stay where they are.
- **Hurry tempo**: `Sounds.HURRY_BPM = 172`. That is above `ALMOST_BPM` (160), so "the faster one" is always HURRY while the clock is under 10 s.

## Review Focus

1. **Pausing**:
   - Risk: the clock keeps falling while paused or during the 3-2-1 countdown.
   - Expected: it stops. Pinned by the controller test in Task 1.
2. **Goal and time running out together**:
   - Risk: a clear reaches the goal while the clock hits 0 during the settle, and the round counts as lost.
   - Expected: the clear wins. Pinned in Task 1.
3. **A star in a piece locked on top of the stack and never cleared**:
   - Risk: the star is lost or wrongly fires.
   - Expected: it stays until its row clears. Pinned in Task 2.
4. **A star collapse that completes new rows**:
   - Expected: those rows clear as a chain, and the counts and time rise again. Pinned in Task 2.
5. **The 10-second warning switches off when bonus time lifts the clock back above 10 s**:
   - Expected: the clock returns to normal and the tempo goes back to `ALMOST_BPM` or normal. Pinned in Task 4 by the ui.dom test.

---

### Task 1: Time limit in the engine, and the new goals

**Files:**
- Modify: `games/blocks/js/constants.js`, `games/blocks/js/engine.js`, `games/blocks/js/controller.js` (`getResult`)
- Test: `tests/blocks/engine.test.js`, `tests/blocks/controller.test.js`

**Interfaces:**
- Produces on `game`:
  - `timeMs` (number, ms left, never below 0)
  - `overReason` (`null` | `'blocked'` | `'timeup'`)
- Produces these events:
  - `{ type: 'time', addMs }`
  - `{ type: 'over', reason }`
- Produces `controller.getResult()`, extended with `timeup: boolean`.

- [ ] **Step 1: Write failing tests** in `engine.test.js` (new `describe('blocks engine time')`):
  - `create` sets `timeMs` to 180000, 150000 and 120000, and `goal` to 15, 30 and 50, for easy, normal and hard. Update the existing goal-20 assertions (`engine.test.js:73`, `controller.test.js:229`) to 30.
  - `E.step(g, 1000)` while falling lowers `timeMs` by exactly 1000.
  - When a clear has 3 own faces, normal adds 9000 and hard adds 6000. A `time` event with that `addMs` follows the `clear` event. A clear with 0 own faces emits no `time` event.
  - With `timeMs = 500`, `E.step(g, 600)` gives `state === 'over'`, `overReason === 'timeup'`, and the events end with `{ type: 'over', reason: 'timeup' }`. `timeMs` is 0.
  - Blocked spawn: the `over` event has `reason: 'blocked'`.
  - Goal priority while settling: set `goal = collected + 1` and `timeMs = 100`, then lock a row that contains an own face. Step 300 ms. The state is `goal`, not `over`.
  - Settle without the goal and with the time at 0: set `timeMs = 100`, then make a clear that has no own faces. Step 300 ms. The state is `over` with reason `timeup`.
- [ ] **Step 2:** Add a controller test: during the countdown, and while paused, `advance(5000)` leaves `game().timeMs` unchanged. After a timeup, `getResult()` gives `{ cleared: false, timeup: true }`.
- [ ] **Step 3:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 4:** Implement:
  - Put the new values in `constants.js`.
  - In `engine.js`, add `timeMs` and `overReason` in `create`.
  - In `step`, decrement the time with a floor of 0, then check timeup when falling.
  - In `startClear`, add `mine * cfg.faceMs` and push the `time` event.
  - In `finishSettle`, do the goal check, then the timeup check, then spawn.
  - Add `reason` to both `over` events.
  - Add `timeup` to `getResult` in `controller.js`.
- [ ] **Step 5:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 6:** Commit: `feat: おちブロックに制限時間を足し、目標の数を 15・30・50 にする`

### Task 2: Star block in the engine

**Files:**
- Modify: `games/blocks/js/engine.js`, `games/blocks/js/pieces.js` (`tryRotate` keeps `star`)
- Test: `tests/blocks/engine.test.js`, `tests/blocks/pieces.test.js`

**Interfaces:**
- Consumes from Task 1: the `time` event, `timeMs`, and the end-of-settle order (goal, then timeup, then spawn).
- Produces:
  - `piece.star` and `next.star` (`null` or 0–3).
  - A board cell `{ charId, star: true }`.
  - The event `{ type: 'star', faces: [{ col, row, charId, mine: true }], collected }`, followed by `{ type: 'time', addMs: STAR_MS + faces.length * faceMs }`.
  - The event `{ type: 'collapse', cells: [[col, row], ...] }` for the star removal. The row collapse keeps `{ type: 'collapse', rows }`.
  - The `clear` event gains `star: boolean`.

- [ ] **Step 1: Write failing tests:**
  - `pieces.test.js`: `tryRotate` returns a candidate with the same `star` as the input.
  - `engine.test.js` (new `describe('blocks engine star')`):
    - Over 200 drawn pieces with seed 3, the gaps between star pieces all fall in [12, 18], and the first star arrives within 18 draws.
    - The shapes and characters drawn for seed 11 are unchanged by the star rolls. The existing `drawn(mk(11), 28)` test still passes without edits.
    - After `hardDrop`, the board cell at `P.cells(shape, rot)[star]` has `star: true`, and no other cell has it.
    - Star clear:
      - Setup: build a board where row 21 is full except one gap, and an own face sits at (col 0, row 18) with an other face below it at (0, 19), and (0, 20) is filled. Lock a star piece that fills the gap.
      - Events: in order `clear` (`star: true`), `time`, `collapse` (rows), `star` (faces include col 0 and every other own face on the board), `time` (addMs = 15000 + n × 3000), `collapse` (cells), then `spawn`.
      - After the second settle, the cell at col 0 that was above the removed face has moved down 1, and the other face at (0, 19) still sits in its place, shifted by the row collapse only.
      - `collected` went up by the own faces in the row plus the star faces.
    - Chain: a star removal that completes a row emits a second `clear` after the cells collapse.
    - A star piece locked without completing a row leaves a star cell on the board. The next clear of that row fires the star effect.
    - Two stars in one clear fire one `star` event.
    - A star clear that reaches the goal ends with `goal`, with no `star` event.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement in `engine.js`:
  - Keep `star` in `moved`.
  - Use the star rng and `_starIn` in `drawNext`.
  - Copy `star` from `next` in `spawn`.
  - Write `star: true` in `lock`.
  - Set `_settle.star` in `startClear`.
  - Branch on `_settle.kind` in `finishSettle`, as in "Star clear sequence" above.
  - In `pieces.js`, copy `star` in `tryRotate`.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックにほしブロックを足す`

### Task 3: Star drawing, lines, reactions and sounds

**Files:**
- Modify: `games/blocks/js/render.js`, `games/blocks/js/lines.js`, `games/blocks/js/reactions.js`, `games/blocks/js/sounds.js`
- Test: `tests/blocks/lines.test.js`, `tests/blocks/reactions.test.js`, `tests/core/bgm-scores.test.js`

**Interfaces:**
- Consumes from Task 2: the `star` flag on board cells, `piece.star` and `next.star`, and the `star` event.
- Produces:
  - The line situations `star` and `timeup`.
  - `Reactions.forStar()`, which returns `{ emotion, situation: 'star' }`, where emotion is one of `['excited', 'cheer']`.
  - `screenFx` returns `'star'` when the events include a `star` event. The priority becomes goal, star, quad, multi, mine, single.
  - The sounds `'blocks-star'` (a fanfare longer than `blocks-quad`) and `'blocks-tick'` (short and soft).
  - `Sounds.HURRY_BPM = 172`.

- [ ] **Step 1: Write failing tests:**
  - `lines.test.js`: add `star: 3, timeup: 3` to `MIN`. The existing length and character checks then cover them.
  - `reactions.test.js`:
    - `forStar().situation === 'star'`, and the emotion is in `['excited', 'cheer']`.
    - `screenFx([{type:'clear', rows:[1,2,3,4], mine:0}, {type:'star'}]) === 'star'`.
    - `screenFx([{type:'star'}, {type:'goal'}]) === 'goal'`.
  - `bgm-scores.test.js`: `A.games.blocks.Sounds.HURRY_BPM > A.games.blocks.Sounds.ALMOST_BPM`.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement:
  - Lines, in each character's voice:
    - `star`: one-shot comeback joy, such as "ほしで いっきに あつまった！".
    - `timeup`: gentle, such as "じかんぎれ、またあそぼう".
  - `forStar` and the `screenFx` priority.
  - The two sounds and `HURRY_BPM`.
  - `render.js`: `drawCell` takes a `star` flag and draws a gold 5-point star over the face. Use about 45% of the cell size, at the top-right corner, with a dark outline so it shows on every face color. Pass the flag for board cells, for the falling piece's index cell, for the ghost at the same alpha, and in `drawNext`.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックのほしの絵・セリフ・音を足す`

### Task 4: Play screen — clock, hurry, star show, timeup result, texts

**Files:**
- Modify: `games/blocks/js/ui.js`, `games/blocks/css/blocks.css`, `games/blocks/js/fx.js` (only if a new effect is needed)
- Modify: `.claude/docs/specs/2026-11-14-blocks-design.md`. Add one line at the top: "時間の制限・ほしブロック・目標の数は `2026-11-14-blocks-thrill-design.md` が正".
- Test: `tests/blocks/ui.dom.test.js` (browser-only)

**Interfaces:**
- Consumes:
  - `game.timeMs` and `HURRY_MS` (Task 1).
  - The `time`, `star`, `collapse{cells}` and `over{reason}` events (Tasks 1 and 2).
  - `Reactions.forStar`, `screenFx` `'star'`, `HURRY_BPM` and the sounds `blocks-star` and `blocks-tick` (Task 3).
  - `result.timeup` (Task 1).

- [ ] **Step 1: Write failing tests** in `ui.dom.test.js`, following that file's existing patterns:
  - The play screen has `.bl-clock` inside `.bl-info`, and it shows `のこり 2:30` for normal right after the start.
  - After the controller advances 61 s while playing, the clock shows `のこり 1:29`.
  - With `timeMs` set to 9000 and one step, `.bl-clock` has `is-hurry`. After setting `timeMs` to 20000 and stepping, `is-hurry` is gone.
  - A `time` event with `addMs` 6000 shows a `.bl-timeadd` element with the text `+6`.
  - Timeup result: the overlay shows `じかんぎれ`, and the character line comes from the `timeup` lines.
  - The settings screen level cards show the goal and the time: `15こ あつめよう` and `3ぷん`. The howto text mentions the time and the star.
- [ ] **Step 2:** Run the browser tests: `scripts\run.bat serve`, then open `http://127.0.0.1:8080/tests/test.html` in the browser pane. Expected: the new tests FAIL. Stop the server you started by its own PID or serverId.
- [ ] **Step 3:** Implement in `ui.js` and `blocks.css`:
  - **Clock**: put `.bl-clock` in `.bl-info`, above `.bl-next`. Keep it inside the existing info column, so `layout.js` does not change. Repaint it from `ui.step` only when the whole seconds change. Format it as `のこり m:ss`.
  - **Hurry**:
    - When `timeMs <= HURRY_MS`, add `is-hurry` (red and blinking), play `blocks-tick` once per whole second, and set the tempo to `HURRY_BPM` while BGM is on.
    - When the clock goes back above 10 s, remove `is-hurry` and set the tempo back to `ALMOST_BPM` if `game.almost`, else `BGM.bpm`.
    - `startBgm` takes hurry into account.
  - **`time`**: show `+N` for N = `addMs / 1000` next to the clock for about 900 ms.
  - **`star`**:
    1. Show `Fx.showBanner('ほし！', 'is-go', 900)` and `Fx.flash(game.frame)`, and play `sfx('blocks-star')`.
    2. Make `flyFaces(p.faces)` fly every face in one wave. Keep the existing gap cap.
    3. Use `react(forStar().emotion)` and `say('star', BUBBLE_MS, true)`.
    4. Hide the star cells while they fly: add `hideCells` to the render opts, or reuse `hideRows` by cell, and clear it on `collapse`.
  - **The `clear` handler**: when `p.star` is set, skip its own screen flash. The `star` event brings its own flash, so one screen effect per lock still holds.
  - **Result**: when `r.timeup`, show the title `じかんぎれ` instead of `おしまい`, and use `line('timeup')`.
  - **Settings and howto**:
    - Each level card adds the time as `3ぷん`, `2ぷん30びょう` or `2ぷん`.
    - The howto adds two lines: `じかんが なくなると おしまい。じぶんの かおを けすと のびるよ` and `ほしの ブロックを けすと、ばんの じぶんの かおが ぜんぶ とんでくる！`.
    - Wrap the long lines to fit 375 px.
- [ ] **Step 4:**
  - Run `scripts\run.bat test`. Expected: 0 failures and 0 violations.
  - Run the browser tests again. Expected: all pass, except the known flaky core IdleTimer and Bgm tests on the first load while the pane is hidden. Reload once.
  - Open `games/blocks/index.html` at 375×812. Check that the clock, the star cell and the start of play look right. Take one screenshot.
- [ ] **Step 5:** Commit: `feat: おちブロックの画面に時計・のこり10びょう・ほしの演出を足す`

### Task 5: Manual test by the user (not dispatched)

- The user plays on real devices and reports back. Do not proceed until the report arrives.
- Checklist:
  - The clock is readable.
  - The last 10 s feel tense.
  - Stars are noticeable in つぎ and on the board.
  - A star clear feels like a comeback.
  - The goal counts 15, 30 and 50 against the times feel right.
  - かんたん does not keep ending in timeups for the daughter.
- Tune the values in `constants.js` from the report. Then do the B-5 closing from the main plan (manual-test record, `mv` to `done/`, ledger lines).
