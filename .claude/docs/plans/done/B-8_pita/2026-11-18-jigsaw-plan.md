# ピタうめっち ジグソー型への作り直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ピタうめっちを「ピースに絵のかけらを描き、見て探してはめる」形に作り直す（1マス＝2×2ドット、ピース 8・12・16 こ、うらがえすなし）。

**Architecture:** 既存の `games/fill/` の分け方（piece → puzzle → engine → controller → ui/render）はそのまま。純粋なコード（piece・puzzle・engine・controller）を先に直して Node でテストし、最後に画面（render・ui）を直す。絵のデータ（`pictures.js`）とずかん・保存・キャラ・音のしくみは変えない。

**Tech Stack:** Vanilla JS（ES5、IIFE、`window.Ailand`）、Node の vm で動くテスト（`describe`/`it`/`expect`）、ブラウザ用テスト `tests/test.html`、盤は Canvas。

**Spec:** `.claude/docs/specs/2026-11-18-pita-jigsaw-design.md`（以下「改訂設計」）。ここに無いことは `.claude/docs/specs/2026-11-17-pita-design.md`（「元の設計」）。前の計画：`.claude/docs/plans/active/B-8_pita/2026-11-17-plan.md`。

## Global Constraints

- ES Modules・fetch・Worker・外部 CDN・外部フォント・`getImageData` 禁止。file:// で動くこと（`tests/static-check.js` が検査）。localStorage は `core/storage.js` 経由だけ。
- 画面の文言はひらがな中心。コード・識別子・コメントは英語。効果音名は `fill-` で始める。
- 操作規約：盤・置き場・ボタンに `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none`（ずかんは `pan-y`）。ボタンは 64×64px 以上、本文 18px 以上。iPhone 縦 390×844px と横 844×390px でスクロールなしに全部収まる。
- 1マス＝2×2ドット（`DOTS_PER_CELL: 2`）。ピースの数 easy 8・normal 12・hard 16。まわす easy なし・normal あり・hard あり。盤の下絵の不透明度 easy 0.45・normal 0.2・hard 0（なし）。絵の上限 easy 24・normal 28・hard 32 ドット（改訂設計 §2.1・§2.2）。
- 分け方：全マスがどれか1つのピースに入る・どのピースも上下左右でつながる・どのピースも平均マス数（枠のマス数 ÷ ピース数）の 0.5 倍以上 1.5 倍以下・同じ種なら同じ結果（改訂設計 §2.2）。
- はまる条件：向きが答えの向き（`rot === 0`）で、離した位置が答えの位置から上下それぞれ・左右それぞれ1マス以内（|dx| ≤ 1 かつ |dy| ≤ 1）。はまったピースは動かない（改訂設計 §2.4）。
- うらがえすはなくす（ボタン・`fill-flip` の音・engine の `flip`）（改訂設計 §2.2）。
- ヒントの影 2000ms（`HINT_MS`）。ヒントを使うとキラキラはつかない（元の設計のまま）。
- 選んだキャラに `worried`・`sadness`・`anger`・`panic` を出さない。はまらずに戻るときキャラは反応しない。
- `prefers-reduced-motion` のとき：弾む・光る・紙吹雪・キラキラを止め、線が消えて絵が出るだけ。
- 保存キー・ずかん・`pictures.js` の絵・`core/` は変えない。ほかのゲームのファイルを変えない。
- コマンドは `scripts\run.bat test` / `scripts\run.bat check` / `scripts\run.bat serve`（`http://127.0.0.1:8080/tests/test.html` でブラウザテスト）。
- コミットは `<type>: <日本語要約>`、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。ブランチ `feat/fill`。push しない。
- プロセスを止めるときは自分が起動した PID だけ（プロセス名指定の停止は禁止）。

## Review Focus

1. 回転が対称なピース（例：2×2 の正方形、まっすぐの棒）を 180 度まわしたまま答えの位置で離す → 形は合うが絵が逆さなので、はまらずに置き場に戻る。→ Task 2 `a symmetric shape in the wrong turn does not snap`。
2. 答えの位置から斜めに1マス（dx=1, dy=1）で離す → はまる。2マスずれ（dx=2）→ 戻る。→ Task 2 `snaps within one cell, returns at two`。
3. はまったピースを盤の上でつかもうとする・まわすを押す → 何も起きない（置き場に戻らない、向きも変わらない）。→ Task 2 `a placed piece is locked`、Task 3 `a placed piece cannot be picked up`。
4. 置き場に残りが1つのとき・ヒント直後にえらんだピースをはめた → ヒントの影が消え、`last`・`clear` が1回ずつ。→ Task 2 `last fires once`・Task 2 `hint prefers the given tray piece`。
5. むずかしい（16こ）を iPhone 縦で開く → 置き場に16こ全部が見え、スクロールしない。かけらの絵柄が見分けられる大きさ。→ Task 3 `hard fits 390x844 with 16 pieces`。

---

## ファイル構成（変わるところだけ）

| ファイル | 変わること |
|---|---|
| `games/fill/js/constants.js` | `DOTS_PER_CELL: 2`。`PIECE_MIN`/`PIECE_MAX` と `minCells`/`maxCells` をやめ、`LEVEL` に `pieces`・`rotate`・`guide` |
| `games/fill/js/piece.js` | `flip`・`orientations` をやめる。`partition(frameCells, rand, count)` に変える |
| `games/fill/js/puzzle.js` | 色をやめる。`start.rot` だけ（easy は 0）。むずかしさは `picture.level` から |
| `games/fill/js/engine.js` | 答えの位置への吸いつき・はまったら固定・`flip` なし・ヒントは置き場から |
| `games/fill/js/controller.js` | `hint(rand, preferId)` |
| `games/fill/js/render.js` | ピースに絵のかけら・盤の下絵・色の表をやめる |
| `games/fill/js/ui.js`・`css/fill.css`・`js/sounds.js` | うらがえすボタンと `fill-flip` をやめる・easy でまわすを出さない・かけらの描画 |
| `tools/fill-pictures/fill-pictures.js` | `const D = 4` → `2`（見本ページの枠の見せ方を合わせる） |
| `tests/fill/*.test.js` | 下の各 Task のとおり |
| `CHANGELOG.md` | ピタうめっちの行を新しい遊び方に合わせる |

---

### Task 1: マスを細かくし、ピース数を決めて分ける（constants・piece・puzzle・絵のテスト）

**Files:**
- Modify: `games/fill/js/constants.js`, `games/fill/js/piece.js`, `games/fill/js/puzzle.js`, `tools/fill-pictures/fill-pictures.js:9`
- Test: `tests/fill/piece.test.js`, `tests/fill/puzzle.test.js`, `tests/fill/pictures.test.js`

**Interfaces:**
- Produces:
  - `Constants.DOTS_PER_CELL === 2`；`Constants.LEVEL[level] = { pieces, rotate, guide, maxDots }` = easy `{8, false, 0.45, 24}`・normal `{12, true, 0.2, 28}`・hard `{16, true, 0, 32}`。`PIECE_MIN`・`PIECE_MAX`・`minCells`・`maxCells` は消す。
  - `Piece.partition(frameCells: [x,y][], rand: () => number, count: number) -> [x,y][][] | null`（絶対座標のピースの配列。条件を満たさなければ null）。
  - `Piece.orient(cells, rot) -> cells`（時計回りに rot 回、正規化済み）。`Piece.flip`・`Piece.orientations` は消す。`normalize`・`rotate`・`same`・`place`・`fits` はそのまま。
  - `Puzzle.make(picture, seed) -> { frame, seed, pieces: [{ id: 'p0'.., cells (normalized, 答えの向き), answer: {x, y}, start: { rot } }], tray: id[] }`。`color` は無い。`start.rot` は `C.LEVEL[picture.level].rotate` が false なら 0、true なら `Math.floor(rand() * 4)`。

- [ ] **Step 1: 失敗するテストを書く**
  - `piece.test.js`：`flip twice returns the same`・`orientations counts` を消す。`partition ...4 to 5` を `partition makes count connected pieces of even size` に置き換え：12×12 の全マスの枠と、`Puzzle.frameOf` を使わない手作りの L 字枠（40マス程度）で、count = 8・12・16、`mulberry32(1..50)` のそれぞれについて、null でない結果は「長さ === count」「全マスがちょうど1回」「各ピースが4方向でつながる」「各ピースの長さ ≥ ceil(0.5 × avg) かつ ≤ floor(1.5 × avg)（avg = マス数 / count）」。さらに 50 種のうち null でないものが 40 以上。`partition is deterministic` は `(cells, rand, 8)` で同じ結果。`orient` に `orient(c, 4)` が `normalize(c)` と同じテストを足す。
  - `puzzle.test.js`：`start is one of 8 orientations and color is 0 to 3` と色の3つのテスト（`same color on neighbors...`・`neighbors get different colors...`）を消す。`every picture makes a valid puzzle` を「全部の絵 × seed 1..30 で、ピース数 === `C.LEVEL[p.level].pieces`、全マス1回・つながる・大きさの決まり（Task 1 と同じ式）」に直す。`start rot follows the level` を足す：easy の絵は全ピース `start.rot === 0`、normal・hard は `0..3` で、`start.flip`・`color` が `undefined`。`frameOf counts cells from dots` は 2×2 区切りの期待値に直す。
  - `pictures.test.js`：`every frame is in range and connected` を `every frame is connected and can be split` に変える：つながっていること、そして `F.Puzzle.make(p, 1)` が例外を出さないこと（`frameCells` の自前計算は `C.DOTS_PER_CELL` を使うのでそのまま）。

- [ ] **Step 2: 失敗を確かめる**
  Run: `scripts\run.bat test`
  Expected: piece・puzzle・pictures の上のテストが FAIL（`partition` の引数・`DOTS_PER_CELL` が古い）。

- [ ] **Step 3: 実装する**
  - `constants.js` を Interfaces のとおりに。
  - `piece.js`：`orient(cells, rot)` から裏返しをなくし、`flip`・`orientations`・`islandsOk`・`freeCount` のうち使わなくなるものを消す。`partition(frameCells, rand, count)` の考え方（形の作り方は実装者に任せるが、次のやり方なら条件を満たしやすい）：
    1. 種マスを count 個選ぶ（1つ目は乱数、2つ目以降は「すでに選んだ種からの格子距離（BFS 距離）の最小値が最大のマス」を候補にし、同点は rand で選ぶ）。
    2. 全ピースから同時に育てる：毎回「いちばん小さいピース」（同点は rand）が、自分に隣りあう空きマスの中から rand で1つ取る。隣りあう空きマスが無いピースは飛ばす。全マスが埋まるまで続ける（枠はつながっているので必ず埋まる）。
    3. 大きさの決まり（0.5×〜1.5× avg）を外れたら null を返す。
  - `puzzle.js`：`colorPieces` と `DIRS` を消す。`make` は `P.partition(frame.cells, rand, C.LEVEL[picture.level].pieces)` を `MAX_TRIES` まで種を変えて試す。`start` は `{ rot }` だけ。
  - `tools/fill-pictures/fill-pictures.js:9` の `D` を 2 にし、`scripts\run.bat fill-pictures` で `pictures.js` に差分が出ないこと（絵のデータは変わらない）を確かめる。見本ページ（`.claude/docs/specs/ui-drafts/fill-samples.html`）の差分はそのまま入れてよい。

- [ ] **Step 4: 通ることを確かめる**
  Run: `scripts\run.bat test` と `scripts\run.bat check`
  Expected: piece・puzzle・pictures が PASS。engine・controller・ui.dom の古い `flip` テストはこの時点で落ちてもよい（Task 2・3 で直す）。落ちたテストの名前を報告に書く。

- [ ] **Step 5: コミット**
  `git commit -m "feat: ピタうめっちのマスを細かくし、むずかしさごとのピース数で枠を分ける"`（末尾に Co-Authored-By）

---

### Task 2: 答えの位置にだけはまり、はまったら動かない（engine・controller）

**Files:**
- Modify: `games/fill/js/engine.js`, `games/fill/js/controller.js`
- Test: `tests/fill/engine.test.js`, `tests/fill/controller.test.js`

**Interfaces:**
- Consumes: Task 1 の `Puzzle.make` の形（`start: { rot }`、`color` なし）、`Piece.orient(cells, rot)`。
- Produces:
  - `Engine.create(puzzle)` の返り値：`shape(id)`、`state(id) -> { rot, at: {x,y}|null }`（`flip` は無い）、`occupied()`、`inTray()`、`drop(id, x, y)`、`turn(id)`（右回り1回。引数 `kind` は取らない）、`isClear()`、`placedCount()`、`hint(rand, preferId?)`、`hintUsed()`、`snapTarget(id, x, y) -> {x, y} | null`（はまるならその答えの位置、はまらないなら null。ui のドラッグの影が使う）。`toTray` は消す。
  - `drop`：`snapTarget` が null でなければ `at = answer`、イベント `[{type:'placed', id}]` に `last`/`clear` を元と同じ決まりで続ける。null なら `[{type:'returned', id}]`。はまっているピースへの `drop`・`turn` は `[]` を返し、何も変えない。
  - `hint(rand, preferId)`：`preferId` が置き場にあればそれ、なければ置き場のピースから rand で1つ。返り値 `{ id, x, y, cells (答えの絶対マス) }`。
  - `Controller`：`turn(id)`・`hint(rand, preferId)`。`toTray` は消す。そのほかは変えない。

- [ ] **Step 1: 失敗するテストを書く**（`engine.test.js` の手作りパズル `mk` から `flip`・`color` を消す）
  - `snaps within one cell, returns at two`：答え (ax, ay) に対し、(ax, ay)・(ax+1, ay)・(ax−1, ay+1)・(ax+1, ay+1) で `placed` かつ `state(id).at` が答えの位置。(ax+2, ay)・(ax, ay−2) で `returned` かつ `at === null`。
  - `wrong turn does not snap`：`start.rot = 1` のピースを答えの位置で `drop` → `returned`。`turn` を3回して `rot === 0` にしてから `drop` → `placed`。
  - `a symmetric shape in the wrong turn does not snap`：2×2 の正方形のピース（`start.rot = 2`）を答えの位置で `drop` → `returned`。
  - `a placed piece is locked`：はめたあとで `drop(id, 0, 0)`・`turn(id)` がどちらも `[]`、`state(id)` が変わらない。
  - `last fires once`・`clear` は新しい drop で書き直す（全部を答えの位置に落として `clear` が1回）。
  - `hint prefers the given tray piece`：`hint(rand, 'p1')` が `p1` を返す。`p1` がはまっていれば置き場のほかのピースを返す。`hintUsed()` が true。
  - `snapTarget matches drop`：はまる位置で答えの位置を、はまらない位置で null を返す。
  - 消すテスト：`out of frame or overlap returns...`・`moving a placed piece frees...`・`a failed move sends...`・`toTray returns...`・`rotate and flip match Piece...`・`turning a placed piece stays or returns`・`turning into an overlap...`・`clear with a different arrangement`・`hint skips correctly placed pieces`・`hint treats an equal-cell placement as correct`（新しいルールでは意味がない）。
  - `controller.test.js` の `ctl.turn(id, n === 3 ? 'flip' : 'rotate')` を `ctl.turn(id)` にし、答えの向きになるまで（`state(id).rot === 0`）回す。

- [ ] **Step 2: 失敗を確かめる**
  Run: `scripts\run.bat test`
  Expected: engine・controller の新しいテストが FAIL。

- [ ] **Step 3: 実装する**
  `engine.js` は `st[id] = { rot, at }` に減らし、`occupiedExcept`・`sameAbsolute`・`isCorrectCells` のうち不要になるものを消す。`snapTarget(id, x, y)` は `st[id].at === null && st[id].rot === 0 && |x − answer.x| ≤ 1 && |y − answer.y| ≤ 1` のとき答えの位置。`controller.js` は Interfaces のとおり。

- [ ] **Step 4: 通ることを確かめる**
  Run: `scripts\run.bat test`
  Expected: engine・controller・piece・puzzle・pictures が PASS（ui.dom は Node では走らない）。

- [ ] **Step 5: コミット**
  `git commit -m "feat: ピタうめっちのピースが答えの位置にだけはまり、はまったら動かないようにする"`

---

### Task 3: ピースに絵のかけらを描き、画面を新しい遊び方に合わせる（render・ui・css・sounds）

**Files:**
- Modify: `games/fill/js/render.js`, `games/fill/js/ui.js`, `games/fill/css/fill.css`, `games/fill/js/sounds.js`, `games/fill/js/layout.js`（必要なら）, `CHANGELOG.md`
- Test: `tests/fill/ui.dom.test.js`, `tests/fill/layout.test.js`（Layout を変えたとき）

**Interfaces:**
- Consumes: Task 2 の `Engine`（`snapTarget`・`turn(id)`・`hint(rand, preferId)`・`state(id).rot`）、Task 1 の `Constants.LEVEL[level].rotate/guide`、`Puzzle.make` の `pieces[i].cells/answer`。
- Produces（ui が使う render の形）：
  - `Render.piece(ctx, picture, piece, rot, cell, dpr, selected?)`：置き場・ドラッグ中のピース1つ。`piece` は Puzzle の1件（`cells`・`answer`）。キャンバスは `orient(piece.cells, rot)` の外枠の大きさ。各マスに答えの位置の 2×2 ドットを描き、`rot` 回 90 度まわした向きで出す。色のないドットはうすい地の色。ふちを線で囲む。
  - `Render.board(ctx, o)`：`o = { frame, picture, guide (0..1), placed: [{ piece }], ghost: { cells }|null, hint: { cells }|null, pop, cell, dpr }`。順に：枠のマス（白・細くうすい点線）→ 下絵（`guide > 0` のとき枠のマスの中だけ、その不透明度で `picture`）→ はまったピース（答えの位置に絵のかけら＋ふち）→ ヒントの影 → ドラッグの影。
  - `Render.COLORS` は消す。`Render.picture`・`Render.shadow` はそのまま。

- [ ] **Step 1: 失敗するテストを書く（`ui.dom.test.js`）**
  - ヘルパー `solveOne` を「`state(id).rot` が 0 になるまで `ctl.turn(id)`、それから `ctl.drop(id, answer.x, answer.y)`」に直す。
  - `rotate and flip buttons act on the selected piece` → `rotate button turns the selected piece`（normal の絵で：えらんだピースの `rot` が +1。`[data-action="flip"]` が無い）。
  - `easy has no rotate button`：easy の絵を開くと `[data-action="rotate"]` が無い（または `hidden`）。normal・hard では出る。
  - `buttons look disabled without a selection` を rotate だけに直す。
  - `pieces show the picture`：置き場のピースのキャンバス1つで、`Render.piece` を差し替えて呼ばれた引数を記録するやり方で、`picture` が開いた絵・`piece` が Puzzle の1件であることを確かめる（`getImageData` は禁止なので画素は読まない）。
  - `a placed piece cannot be picked up`：はめたピースの上で pointerdown→move→up しても `state(id).at` が変わらない。
  - `dragging a tray piece onto the board places it`：答えの位置へ動かして離すと `at` が答えの位置。`dropping outside the board returns the piece` はそのまま通ること。
  - `hint lights the selected tray piece`：ピースをえらんでヒントを押すと、ヒントの `id` がそのピース。
  - `hard fits 390x844 with 16 pieces`：hard の絵を開き、390×844 でページがスクロールしない（既存の `fits 390x844 without scrolling` と同じ見方）、置き場の `.fl-tpiece` が 16 こ、どのピースの1マスも 8px 以上。844×390 でも同じ。

- [ ] **Step 2: 失敗を確かめる**
  Run: `scripts\run.bat serve` を background で起動し、`http://127.0.0.1:8080/tests/test.html` を開く。
  Expected: 上の ui.dom テストが FAIL。

- [ ] **Step 3: 実装する**
  - `render.js`：Interfaces のとおり。向きは `ctx.translate`・`ctx.rotate(rot × 90°)` で答えの向きの絵を描くやり方でよい（ピクセルは読まない）。盤のマスの線は元より細くうすく。
  - `ui.js`：`ACTS` を rotate だけにし、`C.LEVEL[pic.level].rotate` が false のときボタンを出さない。`turnSelected` は `controller.turn(game.selected)` と `fill-rotate`。`colorOf` をやめ、置き場・ドラッグ中・盤の描画を新しい `Render` に。ドラッグの影は `engine.snapTarget` が null でないときだけ、答えの位置に。`pick` は盤の上のピースを返さない（はまったピースはつかめない）。ヒントは `controller.hint(rng, game.selected)` にし、そのピースの置き場の枠を光らせる（`.is-hint` などの CSS、`HINT_MS` で消す）。盤のピースが消える完成の演出はいまの `revealPicture` のまま（下絵も盤のキャンバスと一緒に消える）。
  - 置き場：16 こが 390×844・844×390 に収まる大きさを `Layout.trayScale` で決める。収まらなければ `layout.js` の `PIECE_CELL`・`MIN_SCALE` を直し、`layout.test.js` の期待値も合わせる。
  - `fill.css`：`.fl-actbtn` が1つでも並びが崩れないように。`54` 行目のコメントを「まわす」だけに。
  - `sounds.js`：`fill-flip` を消す。
  - `CHANGELOG.md`：ピタうめっちの行を「絵のかけらのピースを はめて 絵を つくる」に合わせる。

- [ ] **Step 4: 通ることを確かめる**
  Run: `scripts\run.bat test`・`scripts\run.bat check`、ブラウザで `tests/test.html`
  Expected: Node もブラウザも全部 PASS、check OK。`games/fill/index.html` を 390×844 で開いて、easy・normal・hard の1まいずつのスクリーンショットを報告ファイルの横に保存する。起動した serve は自分の PID で止める。

- [ ] **Step 5: コミット**
  `git commit -m "feat: ピタうめっちのピースに絵のかけらを描き、うらがえすをなくす"`
