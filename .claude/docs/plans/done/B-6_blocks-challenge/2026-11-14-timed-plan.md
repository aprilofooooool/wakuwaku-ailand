# おちブロック 3分のきろくチャレンジとかおあつめのタイム記録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give きろくチャレンジ a fixed 3-minute limit with no time bonuses (best count in `best.v2`), and record the fastest clear time per difficulty for かおあつめ (`time.v1`).

**Architecture:** Builds on the finished challenge mode (`2026-11-14-challenge-plan.md`). The engine already runs the clock and timeup for any non-null `timeMs`; challenge now gets `timeMs = CHALLENGE_MS` and skips only the time bonuses. A new `game.elapsedMs` counts play time in `step`. The controller saves both records; the UI shows them.

**Tech Stack:** Vanilla ES5 IIFE on `window.Ailand`, Canvas 2D, Web Audio, Node vm test runner.

**Spec:** `.claude/docs/specs/2026-11-14-blocks-challenge-design.md` §8 (it overrides §1–§7 where they differ).

## Global Constraints

- ES5 only. Each file is one IIFE on `Ailand.games.blocks`. Keep files' line endings.
- Tests: `scripts\run.bat test` (Node tests + static check): 0 failures, 0 violations. `tests/blocks/ui.dom.test.js` is browser-only; the controller runs it in `tests/test.html`.
- `CHALLENGE_MS: 180000` in `constants.js`, the same for every difficulty. No `time` events in challenge (neither faces nor star).
- Storage: challenge best → key `best.v2` (`{ easy, normal, hard }` counts); `best.v1` is no longer read. Collect best time → key `time.v1` (`{ easy, normal, hard }` whole seconds). Missing, non-number, array or ≤ 0 → none (0).
- Time is compared and stored as `Math.ceil(elapsedMs / 1000)` seconds. Smaller is better. Saved only on a clear.
- Collect-mode play, clock, goal, time bonuses and every existing assertion stay unchanged, except assertions that the challenge has no clock / no time, which this plan replaces.
- Never stop processes by name. Commit messages `<type>: <要約>` (Japanese) + blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `.claude/launch.json`.

## Decisions this plan makes

- `game.elapsedMs` (both modes) grows by `ms` in `step` while the state is `falling` or `settling`, the same states that lower `timeMs`. It never changes on time bonuses.
- In challenge the existing end-of-settle order already gives "the clear in progress counts, then time up" (goal is null, so `endSettle` goes straight to the timeup check). A star wave that started still finishes first.
- `getResult()` adds `timeSec` (ceil seconds, both modes), `bestTime` (collect: the better of start best time and this clear; 0 when none) and `newTime` (collect clear with `timeSec < startBestTime` or `startBestTime === 0`). `best`/`newRecord` keep their challenge meaning.
- `controller.bestTimeOf(difficulty) -> number` (seconds, 0 = none).
- Result heading in challenge: `しんきろく！` on a new record, else `じかんです` on timeup, else `おしまい`. Line: `record` on a new record, else `timeup` on timeup, else `over`.
- Collect result on a clear: heading stays `クリア！`; add `タイム m:ss`, and when `newTime` a `しんきろく！` label (class `bl-result-newtime`).

## Review Focus

1. Time bonus during a challenge: Expected none, for faces and star. Pinned in Task 1.
2. Clock reaches 0 in the middle of a challenge clear: Expected the clear's faces count, then `over` with `timeup`. Pinned in Task 1.
3. Pause and countdown do not add to the time record. Pinned in Task 2 (controller advance while paused / counting down leaves `elapsedMs` unchanged).
4. A loss in collect never writes `time.v1`; a slower clear does not overwrite a faster time. Pinned in Task 2.
5. Old `best.v1` from the endless challenge is ignored. Pinned in Task 2.

---

### Task 1: Engine — 3-minute challenge and play time

**Files:** Modify `games/blocks/js/constants.js`, `games/blocks/js/engine.js`. Test `tests/blocks/engine.test.js`.

**Interfaces:** Produces `K.CHALLENGE_MS`, `game.elapsedMs`; challenge `game.timeMs` starts at 180000.

- [ ] **Step 1: Failing tests** (update the existing challenge tests that assert `timeMs === null` / no timeup; keep every collect test unchanged):
  - Challenge `create` gives `timeMs === 180000` for easy, normal and hard; `goal === null`.
  - `E.step(g, 1000)` while falling lowers challenge `timeMs` by 1000 and raises `elapsedMs` by 1000 (both modes).
  - A challenge clear with own faces and a challenge star wave emit no `time` event and leave `timeMs` unchanged.
  - Challenge with `timeMs = 500`, `E.step(g, 600)` while falling → `over` with `reason: 'timeup'`.
  - Challenge, `timeMs = 100`, lock a row with 2 own faces, step 300 ms → `collected` includes the 2, then the events end with `over` `timeup`.
  - Collect: a clear adding time does not change `elapsedMs`.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement: `CHALLENGE_MS` constant; challenge `timeMs`; guard the two time additions with `game.mode !== 'challenge'`; add `elapsedMs` in `create` and `step`.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures, 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックのきろくチャレンジを3分にし、遊んだ時間を数える`

### Task 2: Controller — `best.v2`, time records, result fields

**Files:** Modify `games/blocks/js/controller.js`. Test `tests/blocks/controller.test.js`.

**Interfaces:** Consumes Task 1 `game.elapsedMs`, challenge timeup. Produces `BEST_KEY = 'best.v2'`, `TIME_KEY = 'time.v1'` (exported on `G.Controller`), `controller.bestTimeOf(difficulty)`, `getResult()` fields `timeSec`, `bestTime`, `newTime`.

- [ ] **Step 1: Failing tests:**
  - `bestOf` ignores `best.v1` (`{ easy: 9 }` there → 0) and reads `best.v2`; challenge saves go to `best.v2`.
  - `bestTimeOf` returns 0 for missing / `'x'` / `[5]` / `{ easy: -1 }` / `{ easy: '7' }`, and 83 for `{ easy: 83 }`.
  - `advance(5000)` during the countdown and while paused leaves `game().elapsedMs` unchanged.
  - Collect clear with `elapsedMs = 82100` and no stored time: `time.v1.easy === 83`, `getResult()` gives `{ cleared: true, timeSec: 83, bestTime: 83, newTime: true }`.
  - Stored 80, clear at 83 s: no write (`time.v1.easy` stays 80), `newTime: false`, `bestTime: 80`. Stored 84, clear at 83: writes 83, `newTime: true`. Other difficulties untouched.
  - A collect loss (timeup or blocked) never writes `time.v1`; `newTime: false`.
  - Challenge never writes `time.v1`; challenge timeup result has `timeup: true` and the usual `best`/`newRecord`.
- [ ] **Step 2:** Run `scripts\run.bat test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement: key change; `bestTimeOf` / `saveTime` in the `bestOf` / `saveBest` style; `startBestTime` set in `start()`; save the time in `handle` when a collect round reaches `goal`; extend `getResult` (no-game result gets `timeSec: 0, bestTime: 0, newTime: false`).
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures, 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックのかおあつめのタイムを記録し、きろくを best.v2 にする`

### Task 3: Screens

**Files:** Modify `games/blocks/js/ui.js`, `games/blocks/css/blocks.css` (only if a new class needs style). Test `tests/blocks/ui.dom.test.js`.

**Interfaces:** Consumes Task 1 challenge `timeMs`, Task 2 `bestTimeOf`, `getResult()` fields. Reuses `clockOf(sec)` for `m:ss`.

- [ ] **Step 1: Failing ui.dom tests** (replace the existing ones asserting a hidden clock in challenge):
  - Challenge play shows the clock with `3:00` at the start; under 10 s it hurries like collect; no `+N` appears after a clear.
  - Settings, challenge: each level shows `さいこう Nこ` or `きろく なし`, and `3ぷん`. Settings, collect: a level with `time.v1` 83 shows `ベスト 1:23`; with none, no ベスト text; the existing goal and time texts stay.
  - How-to in challenge contains `3ぷん` and `のびない`.
  - Challenge result: timeup without record → heading `じかんです` and a `timeup` line; timeup with `newRecord` → `しんきろく！` and a `record` line; blocked without record → `おしまい`.
  - Collect clear result: `タイム 1:23` (timeSec 83); with `newTime: true` the `しんきろく！` label shows; with `newTime: false` it does not; a collect loss shows no タイム.
- [ ] **Step 2:** Run `scripts\run.bat test` (static check). ui.dom tests run in the browser by the controller.
- [ ] **Step 3:** Implement per spec §8.1 and §8.2 and this plan's decisions. Remove the challenge-only clock hiding and `paintClock` early return.
- [ ] **Step 4:** Run `scripts\run.bat test`. Expected: 0 failures, 0 violations.
- [ ] **Step 5:** Commit: `feat: おちブロックの画面に3分のきろくチャレンジとタイム記録を出す`

### Task 4: Manual test by the user (not dispatched)

- Challenge ends at 3:00 with a clear result; the last 10 s feel tense; no time bonus.
- Collect clear shows the time; a faster clear shows しんきろく！; settings show ベスト.
- The two modes feel different.
