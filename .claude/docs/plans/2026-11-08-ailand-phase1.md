# わくわく！あいランド Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移植元オセロっちを土台に、入口ページ＋`core/`＋`games/<id>/` 構成のミニゲーム集を作り、オセロっちを移植し、新作「ぽとん4」を追加する。

**Architecture:** 素の HTML/CSS/JS を IIFE で `window.Ailand` に登録し、各ゲームは独立 HTML ページ。DOM 非依存のロジック（エンジン・AI・演出判定・進行・core の純粋部品）は Node の vm で `tests/test.html` の一覧どおりに読み込んでテストする。オセロは名前空間・保存キー・画像パス・読み込み一覧以外を変えず、replay（偽の時計つき）で移植前後の一致を確かめる。

**Tech Stack:** HTML5 / CSS3 / JavaScript ES2017（ライブラリなし）、Web Audio API、Node v22（テスト・計測のみ）、Windows PowerShell 5.1＋System.Drawing（画像縮小）、`scripts\run.bat`。

**Spec:** `.claude/docs/specs/2026-11-08-ailand-requirements.md`（仕様の正）、`.claude/docs/specs/2026-11-08-ailand-phase1-design.md`（設計）。各タスクの実装者は両方の該当節を読む。移植元（読み取り専用）：`../flipflip-othello-src`（コミット `e342642`）。

## Global Constraints

- ES Modules・`import`/`export`・`fetch(`・`XMLHttpRequest`・`new Worker(`・外部 URL・外部フォント・`getImageData` を使わない（file:// で動かすため）。
- すべて IIFE で `window.Ailand` 配下に登録。`<script src>` は依存順。設定データは `.js`。
- ファイル名・フォルダ名は小文字英数字とハイフン（拡張子のドット）のみ。例外は `README.md` と `CHANGELOG.md`。
- 画面の文言はひらがな中心。コード・識別子・コメントは英語。
- localStorage のキーはすべて `ailand:` で始める。旧キー `otc.save.v1` / `otc.settings.v1` は読まない・書かない・消さない。
- 新しく作る画面は Pointer Events、`touch-action: none`（盤と操作ボタン）、タップ領域 64×64px 以上、本文 18px 以上。オセロっちの操作部分は変えない（要件 D7）。
- `prefers-reduced-motion: reduce` では揺れ・点滅・跳ねる動きを止める。
- テキストの読み書きは UTF-8 を明示（Node は `'utf-8'`、PowerShell は `-Encoding UTF8`）。
- 開発コマンドは `scripts\run.bat <test|check|serve|resize-images|measure-drop4|replay-othello>`（Task 2 で作る。Task 1 だけは run.bat が無いので `node` を直接使う）。
- プロセスを止めるときは自分が起動した PID だけ（`taskkill /IM` 等の名前指定は禁止）。
- コミットメッセージは `<type>: <日本語の要約>`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。push・GitHub リポジトリ作成はしない。
- 移植元 `../flipflip-othello-src` と `../flipflip-othello` には一切書き込まない。

## Review Focus

1. 壊れた・古い形式・別バージョンの保存データ（`ailand:drop4:save.v1` に不正 JSON、未知の version、不正な手を含む履歴）→ 例外を出さずに保存を消して新規開始。テストは Task 13。
2. localStorage が使えない（iOS のプライベートブラウズ等で `setItem` が例外）→ ゲームは遊べ、「つづきから」が出ないだけ。テストは Task 4（Storage）と Task 13。
3. 連打・割り込み（CPU 思考中、落下アニメーション中、終局後のタップ、同じ列の3連打）→ 無視され、二重着手しない。テストは Task 13（controller が手番外・終局後の入力を拒否）と Task 14（UI の入力ロック）。
4. 画面の回転・サイズ変更（対局中に縦⇔横）→ 盤とゴーストが再配置され、選択中のゴーストは解除。テストは Task 14（レイアウト計算の純関数）。
5. 音が使えない状態（AudioContext 未作成・suspended、おと OFF）で `play` / BGM 開始・テンポ変更が呼ばれる → 例外なしで何もしない。テストは Task 16。

---

## ファイル構成（作る・動かすもの）

設計書 §3 のとおり。タスクごとの **Files** に正確なパスを書く。

---

### Task 1: 移植元の無改変取り込み

**Files:**
- Create: 作業ツリー一式（移植元 `e342642` のコミット内容そのもの）

**Interfaces:**
- Produces: リポジトリ（`main` ブランチ）。コミット1＝移植元のみ、コミット2＝あいランドの文書。

- [ ] **Step 1:** `git init -b main`。
- [ ] **Step 2:** `git -C ../flipflip-othello-src archive e342642 | tar -x -C .` で取り出す。`git -C ../flipflip-othello-src ls-tree -r --name-only e342642 | wc -l` と取り出したファイル数（`.claude/docs/specs/2026-11-08-*`・`logo-drafts/`・`ui-drafts/`・`.claude/docs/plans/2026-11-08-ailand-phase1.md` を除く）が一致することを確認。
- [ ] **Step 3:** `node tests/run-node.js` → `passed N / failed 0`（N を記録）。`node tests/static-check.js` → 問題0件。
- [ ] **Step 4:** 移植元のファイルだけを add してコミット：`chore: flipflip-othello e342642 を取り込み`。
- [ ] **Step 5:** あいランドの文書（要件・設計・`logo-drafts/`・`ui-drafts/`・本計画）を add してコミット：`docs: あいランドの要件・設計・計画を追加`。

### Task 2: run.bat と移植前の基準（replay golden）

**Files:**
- Create: `scripts/run.bat`、`tests/tools/replay-othello.js`、`tests/golden/othello-replay.json`

**Interfaces:**
- Produces: `scripts\run.bat <sub>`。`replay-othello.js [--write]`：引数なしで golden と比較し一致なら exit 0、`--write` で golden を書く。

- [ ] **Step 1:** `scripts/run.bat` を作る。先頭で `chcp 65001 >nul`、`cd /d "%~dp0.."`。サブコマンドの対応は設計書 §8 の表どおり（`resize-images` は Task 7 まで「未実装」と表示して exit 1、`measure-drop4` は Task 10 まで同様）。引数なし・未知の引数は使い方を表示して exit 1。終了コードを呼び出し元に返す。
- [ ] **Step 2:** `replay-othello.js` を作る（設計書 §4.4）。要点：
  - 読み込むファイル一覧は定数 `FILES` に持つ（このタスクでは移植元の `js/...` 順＝`tests/test.html` の非テスト部分。Task 3 で書き換える）。
  - vm の sandbox に `performance = { now: fakeNow }`。`fakeNow` は呼ばれるたびに 0.05ms 進む。`setTimeout` は即時実行キュー（scheduler）に置き換える。
  - `GameController` に `rng: mulberry32(seed)`、即時 scheduler、メモリ storage を注入。人間席は合法手を rng で選ぶ。
  - 組：`{solo, duo, four} × ルール（8x8標準/アンチ、6x6標準/アンチ、four は 8 のみ）× CPU 強さ全種 × seed 1..5`。
  - 記録：組ごとに `{moves:[...], board:[...], emotions:[{player, emotion}...], result}`。
  - 全組 5 分超なら強さ「つよい」を seed 1..2 に減らす（減らした事実を出力に出す）。
- [ ] **Step 3:** `node tests/tools/replay-othello.js --write` → golden 生成。続けて引数なしで実行 → `replay: N/N match`、exit 0（決定的であることの確認。2回目も同じ）。
- [ ] **Step 4:** `scripts\run.bat test` と `scripts\run.bat check` が Task 1 と同じ結果。
- [ ] **Step 5:** コミット：`test: オセロ移植前の replay 基準と run.bat を追加`。

### Task 3: オセロを games/othello へ移し名前空間を Ailand に

**Files:**
- Move: `.claude/docs/{specs,plans,reports,research}/` の移植元由来ファイル → `.claude/docs/legacy-othello/<同名サブフォルダ>/`（Task 1 のコミット1に含まれるものだけ）
- Move: `index.html` → `games/othello/index.html`、`js/**` → `games/othello/js/**`、`css/game.css`・`css/top.css` → `games/othello/css/`、`css/{theme,base,effects}.css` → `games/othello/css/`（オセロ専用として持つ。共通 CSS は Task 5 で別に作る）
- Move: `tests/*.test.js` → `tests/othello/`、`tests/tools/measure-*.js` → `tests/othello/tools/`
- Create: `core/namespace.js`
- Modify: `games/othello/js/core/namespace.js`、`games/othello/js/config/constants.js:46,55`、`games/othello/js/data/characters.js`（`image.dir`）、`tests/test-runner.js:69`、`tests/run-node.js`、`tests/test.html`、`tests/static-check.js`、`tests/othello/characters.test.js:19-22`、`tests/tools/replay-othello.js`（FILES）

**Interfaces:**
- Produces: `window.Ailand = { core: {}, games: {} }`（`core/namespace.js`。既にあれば上書きしない）。`Ailand.games.othello` にオセロの全モジュール（旧 `Otc.*` と同名）。`Ailand.Test`（旧 `Otc.Test`）。

- [ ] **Step 1:** `git mv` で文書と上記ファイルを移す。
- [ ] **Step 2:** `core/namespace.js`：`window.Ailand = window.Ailand || { core: {}, games: {} };`（core/games が無ければ足す）。`games/othello/js/core/namespace.js`：`Ailand.games.othello = Ailand.games.othello || {};`。
- [ ] **Step 3:** オセロの全 js・テストで `Otc.` → `Ailand.games.othello.`、`window.Otc` → `Ailand.games.othello` に置き換える（ファイル冒頭で `var O = Ailand.games.othello;` の別名を置いてもよい。ロジックは変えない）。`Otc.Test` は `Ailand.Test`。
- [ ] **Step 4:** 保存キー：`SAVE_KEY: 'ailand:othello:save.v1'`、`SETTINGS_KEY: 'ailand:othello:settings.v1'`。
- [ ] **Step 5:** 画像：`image.dir` を `'../../assets/characters/<id>/'` に（ページが `games/othello/` にあるため。設計書の `data-base` 方式はぽとん4 と core 部品で使い、オセロはデータ1行の変更で済ませる）。`tests/othello/characters.test.js` の期待値を同じ形に直す。
- [ ] **Step 6:** `games/othello/index.html` の script/link を新パスに（`../../core/namespace.js` を最初に読む）。`tests/test.html` の一覧を新パスに（`../core/namespace.js` → `test-runner.js` → オセロ群 → `othello/*.test.js`）。`tests/run-node.js` の `Otc.Test.run()` を `Ailand.Test.run()` に。
- [ ] **Step 7:** `tests/static-check.js`：検査対象を `index.html`（存在すれば）、`games/*/index.html`、`tests/test.html`、`core/**`、`games/**`、`css/**` の css/js に。画像存在の検査は `games/othello/js/data/characters.js` の dir を `games/othello/` 基準で解決。`.claude` の除外は維持。
- [ ] **Step 8:** `replay-othello.js` の FILES を新パスに、`Otc` 参照を `Ailand.games.othello` に。
- [ ] **Step 9:** `scripts\run.bat test` → Task 1 と同じ件数で `failed 0`。`scripts\run.bat check` → 0件。`scripts\run.bat replay-othello` → `N/N match`。
- [ ] **Step 10:** ルートに仮の `index.html`（`games/othello/index.html` へのリンクだけ）を置き、`games/othello/index.html` を file:// で開いてコンソールエラー0件を確認（Browser pane）。
- [ ] **Step 11:** コミット：`refactor: オセロを games/othello へ移し名前空間を Ailand にする`。

### Task 4: core の DOM 非依存部品

**Files:**
- Create: `core/event-bus.js`、`core/storage.js`、`core/rng.js`、`core/characters.js`、`core/common-lines.js`、`core/line-picker.js`、`core/emotion-map.js`
- Test: `tests/core/event-bus.test.js`、`tests/core/storage.test.js`、`tests/core/rng.test.js`、`tests/core/characters.test.js`、`tests/core/line-picker.test.js`、`tests/core/emotion-map.test.js`
- Modify: `tests/test.html`（core と core テストを追加）

**Interfaces:**
- Produces:
  - `Ailand.core.EventBus.create()` → `{on(name, fn) → off, emit(name, payload)}`
  - `Ailand.core.Storage.create(gameId)` → `{get(key, fallback), set(key, value) → boolean, remove(key), has(key) → boolean}`。実キー `'ailand:' + gameId + ':' + key`。`Ailand.core.Storage._backend`（既定 `window.localStorage`、テストで差し替え）。
  - `Ailand.core.Rng.mulberry32(seed) → () => number [0,1)`
  - `Ailand.core.Characters.list() → Profile[]`、`get(id) → Profile|null`。Profile = `{id, name, colors:{main, sub}, image:{dir:'assets/characters/<id>/', ext:'png'}, face:{normal, joy, anger, sadness, panic, thinking}, voice:{firstPerson, ending}}`（値は移植元 `js/data/characters.js` からコピー、`lines` と `hasDisc` は持たない）
  - `Ailand.core.CommonLines`：`{ [situation]: string[] }`（設計書 §6.8 の12状況、各3行以上、キャラ非依存）
  - `Ailand.core.LinePicker.create({gameLines, commonLines, rng})` → `pick(charId, situation) → string`（`gameLines[charId][situation]` → `commonLines[situation]` → `''` の順。同じキャラ・状況で直前と同じ行を避ける）
  - `Ailand.core.EmotionMap.resolve(logical) → {image, mark}`（要件 1.5 の表。未知の名前は `{image:'normal', mark:null}`）、`Ailand.core.EmotionMap.LOGICAL`（論理表情名の配列）

- [ ] **Step 1: 失敗するテストを書く**（主な assertion）
  - storage：`create('drop4').set('save.v1', {a:1})` で backend に `ailand:drop4:save.v1` が入る。`get('x', 5)` は未設定で 5。backend の `setItem` が例外を投げても `set` は `false` を返し例外を出さない（Review Focus 2）。不正 JSON の値で `get` は fallback。
  - rng：`mulberry32(1)` の最初の3値が移植元 `tests/ai.test.js:9-10` の実装と一致。
  - characters：4体（mametchi, kuchipatchi, mimitchi, flowertchi）。各 id が `^[a-z0-9-]+$`、`image.dir === 'assets/characters/' + id + '/'`、`lines` を持たない。
  - line-picker：ゲーム別があればそれ、無ければ汎用。同じ状況を2回連続で引いて同じ行にならない（行が2つ以上あるとき）。
  - emotion-map：`resolve('surprised')` → `{image:'panic', mark:'bang'}`、`worried` → `{panic, sweat}`、`excited` → `{joy, sparkle}`、`sleep` → `{normal, zzz}`、`angry-steam` → `{anger, steam}`、`joy` → `{joy, null}`、`'unknown'` → `{normal, null}`。
- [ ] **Step 2:** `scripts\run.bat test` → 新テストが FAIL。
- [ ] **Step 3:** 実装（event-bus は移植元 `js/core/event-bus.js` を名前空間だけ変えて流用、storage は移植元 `js/core/storage.js` の try/catch 方式に接頭辞を足す）。
- [ ] **Step 4:** `scripts\run.bat test` → 全件 PASS（オセロ含む）。`check` 0件。
- [ ] **Step 5:** コミット：`feat: core の共通部品（bus・保存・乱数・キャラ・セリフ・表情表）を追加`。

### Task 5: 共通 CSS・キャラ表示・共通ヘッダー（オセロにも付ける）

**Files:**
- Create: `css/theme.css`、`css/base.css`、`css/header.css`、`core/character-view.js`、`core/ui-common.js`
- Test: `tests/core/character-view.test.js`、`tests/core/ui-common.dom.test.js`（`data-browser-only`）
- Modify: `games/othello/index.html`（共通ヘッダー）、`games/othello/css/` に背景を残す（オセロはクリーム色のまま）

**Interfaces:**
- Consumes: `Characters.get`、`EmotionMap.resolve`
- Produces:
  - `Ailand.core.CharacterView.basePath() → string`（`document.documentElement.dataset.base`、無ければ `''`。Node では `''`）
  - `CharacterView.candidates(profile, logical) → string[]`（`resolve(logical).image` の画像 → `normal`。重複なし。各要素は `basePath + dir + name + '.' + ext`）
  - `CharacterView.apply(imgEl, profile, logical)`（onerror で次の候補、尽きたら `renderFallback`）、`CharacterView.renderFallback(el, profile, logical)`（色つき円＋`face[image] || face.normal`）、`CharacterView.markOf(logical) → mark`
  - `Ailand.core.UI.header({title, onBack, onSound, onSettings, soundOn}) → HTMLElement`（ボタン3つ、各 64×64px 以上、`aria-label` 付き）、`UI.modal(title, nodes) → {close()}`、`UI.toast(text, ms)`
  - CSS 変数（`css/theme.css`）：形・影・フォント・共通アクセント色は移植元 `css/theme.css` と同じ値。背景は `--page-bg`、`--page-dot` をページごとに上書きする前提。

- [ ] **Step 1:** 失敗するテスト：`candidates(mametchi, 'surprised')` → `['assets/characters/mametchi/panic.png', 'assets/characters/mametchi/normal.png']`。`candidates(p, 'normal')` は1要素。`markOf('sleep') === 'zzz'`。
- [ ] **Step 2:** FAIL 確認 → 実装 → PASS 確認（`scripts\run.bat test`）。
- [ ] **Step 3:** オセロにヘッダーを付ける：「もどる」＝`../../index.html` へ遷移、「おと」＝オセロ既存のサウンド設定の切替関数を呼ぶ（`games/othello/js/ui/ui-manager.js:210` の処理を呼ぶ。新しいロジックは書かない）、「せってい」＝オセロのトップ画面に戻す既存処理を呼ぶ。オセロの既存レイアウトの上に重ならないよう、ヘッダーの高さ分だけ `#screen-top`/`#screen-game` を下げる。
- [ ] **Step 4:** `test`・`check`・`replay-othello` が緑。Browser pane でオセロを 390×844 と 1280×800 で開き、ヘッダーと盤が重ならないこと・コンソールエラー0件をスクリーンショットで確認。
- [ ] **Step 5:** コミット：`feat: 共通 CSS・キャラ表示・共通ヘッダーを追加しオセロに付ける`。

### Task 6: 入口ページ

**Files:**
- Create（置き換え）: `index.html`、`css/top.css`、`core/games.js`
- Test: `tests/core/games.test.js`

**Interfaces:**
- Produces: `Ailand.core.Games.LIST`：`[{id, name, href, ready:boolean, saveKey|null}]`。順：drop4（ぽとん4、`games/drop4/index.html`、ready、`ailand:drop4:save.v1`）、othello（オセロっち、`games/othello/index.html`、ready、`ailand:othello:save.v1`）、whack（キャラたたき）、fill（ピース埋め）、territory（ピース陣取り）、blocks（落ちブロック）、chain（落ちもの連鎖）の5本は ready:false。`Games.hasSave(game, backend) → boolean`。

- [ ] **Step 1:** 失敗するテスト：7件、ready は2件、全 id が `^[a-z0-9-]+$`、`hasSave` は backend にキーがあるときだけ true（ready:false は常に false）。
- [ ] **Step 2:** FAIL → 実装 → PASS。
- [ ] **Step 3:** `index.html`（`<html lang="ja" data-base="./">`、`<title>わくわく！あいランド</title>`）。ロゴは `.claude/docs/specs/logo-drafts/logo-v2.html` の案 B を本番化（`css/top.css`。背景はラベンダー系 `--page-bg: #f3ecff`）。カードは `Games.LIST` から生成。ready は `<a>`、未実装は `aria-disabled="true"`・薄い色・「じゅんびちゅう」。中断データがあるカードに「つづきから」バッジ。動きは `prefers-reduced-motion: no-preference` のときだけ。
- [ ] **Step 4:** Browser pane で 390×844・844×390・1280×800 を撮影。ロゴが2行以内で切れない、カードが 64px 以上、コンソールエラー0件。reduced-motion をエミュレートして動きが止まることを確認。
- [ ] **Step 5:** `test`・`check` 緑。コミット：`feat: 入口ページとロゴを追加`。

### Task 7: 画像縮小ツール

**Files:**
- Move: `assets/characters/<id>/*.png` → `assets-src/characters/<id>/*.png`（`git mv`）
- Create: `tools/resize-images/resize-images.ps1`、`assets/characters/<id>/*.png`（生成物、512px）、`tests/tools/png-info.js`
- Modify: `scripts/run.bat`（`resize-images` を有効化）、`tests/static-check.js`（PNG 検査）

**Interfaces:**
- Produces: `resize-images.ps1 [-Src assets-src/characters] [-Dst assets/characters] [-Size 512]`。`png-info.js` の `readPngInfo(buffer) → {width, height, colorType}`（IHDR を読む）。

- [ ] **Step 1:** 失敗する検査を static-check に追加：`assets/characters/**/*.png` がすべて 512×512 かつ colorType 6（RGBA）。`assets-src/` 以外から `assets-src/` を参照していない（html/css/js に文字列 `assets-src` が無い）。
- [ ] **Step 2:** `scripts\run.bat check` → FAIL（まだ原寸）。
- [ ] **Step 3:** `resize-images.ps1`：`Add-Type -AssemblyName System.Drawing`。各 PNG を `Bitmap(512,512, Format32bppArgb)` に `Graphics`（`InterpolationMode=HighQualityBicubic`、`CompositingMode=SourceOver`、`PixelOffsetMode=HighQuality`、背景 Transparent）で縦横比を保って中央に描き、PNG で保存。正方形でない入力は長辺を 512 に合わせ余白は透明。出力フォルダが無ければ作る。処理した枚数と合計バイト数を表示。
- [ ] **Step 4:** `scripts\run.bat resize-images` → 24枚。`scripts\run.bat check` → 0件。合計サイズ（前後）を記録（Task 18 で使う）。
- [ ] **Step 5:** Browser pane でオセロのキャラ表示が崩れていないこと（透過が保たれていること）を確認。`test`・`replay-othello` 緑。
- [ ] **Step 6:** コミット：`feat: キャラ画像の縮小ツールを追加し表示用画像を 512px にする`。

### Task 8: ぽとん4 エンジン（基本ルール）

**Files:**
- Create: `games/drop4/js/namespace.js`（`Ailand.games.drop4 = Ailand.games.drop4 || {}`）、`games/drop4/js/constants.js`、`games/drop4/js/engine.js`
- Test: `tests/drop4/engine.test.js`

**Interfaces:**
- Produces（`Ailand.games.drop4.Engine`。すべて純関数、引数の state を変更しない）：
  - `SIZES = {2:{cols:7, rows:6}, 3:{cols:9, rows:7}, 4:{cols:10, rows:8}}`、`EMPTY = 0`、`BLOCK = 9`
  - `create(settings) → State`。settings = `{players:2|3|4, teams:boolean, popOut:boolean, blocks:boolean, firstSeat:1..players}`。`teams` は players===4 のときだけ有効。
  - State = `{cols, rows, cells:number[] (cols*rows, index c*rows+r, r=0 が最下段), players, teams, popOut, blocks, order:number[] (席の手番順), turnIndex, moveCount, blocksLeft:{[seat]:number}, lastMove:Move|null, result:null|Result}`
  - Move = `{type:'drop'|'pop'|'block', col:number, seat:number}`
  - Result = `{type:'win', seats:number[], team:null|0|1, lines:number[][][]}` または `{type:'draw', reason:'full'|'limit'}`
  - `at(state, c, r) → cell`、`currentSeat(state) → seat`、`teamOf(state, seat) → null|0|1`（チーム戦：席1,3→0、席2,4→1）
  - `legalMoves(state) → Move[]`、`apply(state, move) → State`（不正手は `Error('illegal move')`）
  - `immediateWins(state, seat) → number[]`（いまその席が drop すれば勝つ列。チーム戦は味方のコマも数える）
  - `emptyCount(state) → number`

- [ ] **Step 1: 失敗するテスト**
  - 縦・横・斜め右上・斜め右下の4連でそれぞれ `result.type==='win'`、`lines` に4マス。
  - 3連では勝たない。5連でも勝ち（lines は5マス分を含んでよい）。
  - 満杯の列は `legalMoves` に無く、`apply` は throw。
  - 2人 7×6 を勝ちなしで埋める既知の手順 → `{type:'draw', reason:'full'}`。
  - 3人の手番巡回：firstSeat=2 で order が `[2,3,1]`、`currentSeat` が 2→3→1→2。
  - 4人チーム戦：order が A1,B1,A2,B2（firstSeat が席1のとき `[1,2,3,4]`）。席1と席3のコマ混在の4連で `{type:'win', team:0, seats:[1,3]}`。
  - 終局後の `legalMoves` は空。`apply` は throw（Review Focus 3）。
  - `immediateWins`：横3連の両端が置ける局面で2列を返す。
- [ ] **Step 2:** `scripts\run.bat test` → FAIL。
- [ ] **Step 3:** 実装。勝ち判定は着手マスを起点に4方向を数える（チーム戦は同チーム席を同一視）。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: ぽとん4 のエンジン（基本ルール）を追加`。

### Task 9: ぽとん4 エンジン（ぬきとり・おじゃまブロック・手数上限）

**Files:**
- Modify: `games/drop4/js/engine.js`
- Test: `tests/drop4/engine-options.test.js`

**Interfaces:**
- Consumes/Produces: Task 8 の API に `pop` / `block` を加える（型は Task 8 のまま）。

- [ ] **Step 1: 失敗するテスト**（要件 3.3〜3.5）
  - popOut=false では `pop` が legalMoves に無い。popOut=true で最下段が自分の色の列だけ `pop` がある。味方・相手・ブロックの列には無い。
  - pop で列が1段下がる（最上段は空）。
  - pop で自分だけそろう → 自分の勝ち。自分と相手が同時にそろう → 抜いた人の勝ち（`seats` は抜いた人、チーム戦は抜いた人のチーム）。相手だけそろう → 相手の勝ち。3人で抜いた人以外の2人が同時 → 抜いた人の次の席順で最初の人。
  - blocks=true で各席 `blocksLeft===2`。`block` は BLOCK を落とし、残りが減る。0 なら legalMoves に無い。BLOCK はだれの並びにも数えない（BLOCK を挟んだ5マスで勝たない）。
  - popOut=true でも満杯で `draw/full`。
  - 手数上限：`moveCount >= cols*rows*2` で `draw/limit`（drop と pop を交互に繰り返す手順で 84 手目に引き分け、2人 7×6）。
- [ ] **Step 2:** FAIL → **Step 3:** 実装（pop 後は列の全マスを起点に勝ち判定）→ **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: ぽとん4 のぬきとり・おじゃまブロック・手数上限を追加`。

### Task 10: ぽとん4 CPU と強さの計測

**Files:**
- Create: `games/drop4/js/ai.js`、`tests/tools/child-proxy.js`、`tests/tools/measure-drop4.js`
- Test: `tests/drop4/ai.test.js`
- Modify: `scripts/run.bat`（`measure-drop4` を有効化）、`games/drop4/js/constants.js`（AI パラメータ）

**Interfaces:**
- Consumes: Engine（Task 8・9）、`Rng.mulberry32`
- Produces（`Ailand.games.drop4.Ai`）：
  - `chooseMove(state, level, {rng, now}) → Move`（同期。テストと計測用）
  - `search(state, level, {rng, now, scheduler}) → Promise<Move>`（一定ノードごとに `scheduler(fn)` で区切る。ブラウザでは `setTimeout(fn, 0)`）
  - level は `'weak'|'normal'|'strong'`。パラメータは `constants.js` の `AI = {weak:{winRate:0.6, blockRate:0.3, blockUseRate:0.02}, normal:{depth:4, noise:…}, strong:{budgetMs:400, maxDepth2p:10, maxDepthMulti:5}}`（初期値。計測で調整）
  - `child-proxy.js` は `chooseChildMove(state, rng) → Move`（勝てる手 80%、止める手 50%、他は中央寄り）。Node の `module.exports` と vm 両対応にしない（Node 専用ツール）。

- [ ] **Step 1: 失敗するテスト**
  - normal/strong：すぐ勝てる手があれば必ず打つ。相手のすぐ勝つ手は必ず止める（drop またはブロック）。
  - weak：seed 固定で 100 局面中、勝てる手を打つ割合が 0.45〜0.75（winRate 0.6 の確認）。
  - 3人・4人・チーム戦・popOut・blocks の局面でも合法手を返す。
  - 返す手は常に `legalMoves` に含まれる（ランダム局面 200 個）。
  - `search` は `chooseMove` と同じ手を返す（同じ rng・同じ now）。
- [ ] **Step 2:** FAIL → **Step 3:** 実装（設計書 §6.2：2人 negamax＋αβ、3〜4人 paranoid、評価は窓の数＋中央列）→ **Step 4:** PASS。
- [ ] **Step 5:** `measure-drop4.js`：各強さ vs 子ども役を 2人 7×6・先後交互で 200 局、子ども役の勝率と引き分け率、「ふつう」と「つよい」の1手の思考時間の最大・平均（実時計）を表示。`strong vs normal` の勝率も表示。`--seed`、`--games` 引数。
- [ ] **Step 6:** `scripts\run.bat measure-drop4` を実行し、目標（weak 70〜80%、normal 45〜55%、strong が normal に 80% 以上、normal 最大思考 ≤ 500ms）に入るまで `constants.js` の AI パラメータだけを調整。調整の経過と最終値を `.claude/docs/reports/2026-11-08-drop4-ai-measure.md` に記録。
- [ ] **Step 7:** `test` 緑。コミット：`feat: ぽとん4 の CPU と強さ計測を追加`。

### Task 11: 演出判定と core/reaction.js

**Files:**
- Create: `games/drop4/js/reactions.js`、`core/reaction.js`
- Test: `tests/drop4/reactions.test.js`、`tests/core/reaction.test.js`

**Interfaces:**
- Consumes: `Engine.immediateWins`、`Engine.emptyCount`、`Engine.teamOf`
- Produces:
  - `Ailand.games.drop4.Reactions.detect(before, move, after, ctx) → Event[]`。ctx = `{endgameFired:boolean}`。Event = `{kind:'place'|'reach'|'double'|'block'|'endgame'|'win'|'lose'|'draw', seat, emotion, by:seat}`（emotion は論理表情名）。
  - `Reactions.PRIORITY = ['win','lose','draw','double','block','reach','endgame','place']`
  - `Ailand.core.Reaction.pick(events, {humans:number[], mover:number, priority:string[], teamOf}) → {event, perspective:'win'|'lose'|'draw'|'normal'}|null`（設計書 §6.4 の「人間側の視点」）
  - `Ailand.core.Reaction.createBatcher(onFlush, scheduler) → {push(event)}`（同一タスク内の push を1回の onFlush(events[]) にまとめる）

- [ ] **Step 1: 失敗するテスト**（要件 3.9 の表）
  - reach：打った人 joy、そろうマスを持たれた他の人 worried。
  - double：打った人 excited、他 surprised。reach は同時に出さない。
  - block：相手の `immediateWins` の列に置く → 打った人 joy、止められた人 anger。ブロック（灰色）でも同じ。
  - endgame：空き ≤ 盤の1/4 で1回だけ（ctx.endgameFired=true なら出ない）。全員 thinking。
  - win：勝者 excited、他 sadness。draw：全員 joy。
  - 打った本人に worried/surprised/anger/sadness が出ない（ランダム 300 手で検査。勝敗の sadness は他人のみ）。
  - pick：CPU だけが勝ち → perspective 'lose'。人間が勝者に1人でも → 'win'。ブロックしながらリーチ → block が選ばれる。
  - batcher：同期で3回 push → onFlush が1回、要素3。
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: ぽとん4 の演出判定と共通 reaction を追加`。

### Task 12: ぽとん4 のセリフ

**Files:**
- Create: `games/drop4/js/lines.js`
- Modify: `core/common-lines.js`（Task 4 で作った汎用セリフの見直しのみ）
- Test: `tests/drop4/lines.test.js`

**Interfaces:**
- Produces: `Ailand.games.drop4.Lines = { [charId]: { [situation]: string[] } }`。situation は `start, reach, reached, block, blocked, double, doubled, endgame, win, lose, draw, thinking`。

- [ ] **Step 1:** 失敗するテスト：4キャラ × 12状況すべてに3行以上、各行 1〜20 文字（`Array.from(s).length`）、空白だけの行なし、キャラ内で重複なし、移植元オセロのセリフ（`games/othello/js/data/characters.js` の lines）と完全一致する行がない。
- [ ] **Step 2:** FAIL → **Step 3:** 書く。口調は `.claude/docs/legacy-othello/research/2026-10-29-character-voice.md` と `core/characters.js` の `voice` に合わせる。公式セリフは使わない。→ **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: ぽとん4 のセリフを追加`。

### Task 13: 対局進行（controller）

**Files:**
- Create: `games/drop4/js/controller.js`
- Test: `tests/drop4/controller.test.js`

**Interfaces:**
- Consumes: Engine、Ai.search、Reactions.detect、`Storage.create('drop4')`、LinePicker
- Produces（`Ailand.games.drop4.Controller.create(deps)`）：deps = `{bus, rng, scheduler, storage, ai, now, linePicker}`。
  - `start(settings)`：settings = Engine の settings ＋ `{seats:[{seat, charId, human:boolean}], level}`
  - `resume() → boolean`、`hasSave() → boolean`、`input(move) → boolean`（人間の手番かつ合法のときだけ true）、`undo() → boolean`、`undoLeft() → number`、`state() → State`、`isBusy() → boolean`（CPU 思考中・演出待ち）
  - emit：`started {state}`、`turn {seat, human}`、`thinking {seat, on}`、`moved {move, before, after}`、`reaction {events, picked}`、`gameover {result, perspective}`、`undo {state}`
  - 定数：`CPU_MIN_WAIT_MS = 600`、`UNDO_MAX = 3`、保存キー `save.v1`（実キー `ailand:drop4:save.v1`）、設定キー `settings.v1`

- [ ] **Step 1: 失敗するテスト**
  - CPU の手は思考開始から 600ms（`now` で計測、偽時計）未満では反映されない。
  - 人間の手番以外・`isBusy()` 中・終局後の `input` は false で状態不変（Review Focus 3）。
  - 着手ごとに保存され、新しい controller で `resume()` → 同じ盤面・手番・blocksLeft・undoLeft。終局で保存が消える。
  - 保存データが不正 JSON／version≠1／不正な手を含む → `resume()` は false、保存は消える、例外なし（Review Focus 1）。
  - storage の set が失敗しても対局は進む（Review Focus 2）。
  - undo：人間1人＋CPU のときだけ可。直前の人間の手番の直前まで戻る。3回で `undoLeft()===0`、4回目は false。人間2人以上なら常に false。
  - `gameover.perspective` が Task 11 の `pick` と一致。
- [ ] **Step 2:** FAIL → **Step 3:** 実装（保存形式は設計書 §6.5：`{version:1, settings, history:[Move...], undoLeft}`、再開は先頭から再生）→ **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: ぽとん4 の対局進行・保存・再開・もどすを追加`。

### Task 14: ぽとん4 の画面（設定画面・対局画面・入力）

**Files:**
- Create: `games/drop4/index.html`（`<html lang="ja" data-base="../../">`、`<title>ぽとん4 - わくわく！あいランド</title>`）、`games/drop4/css/drop4.css`、`games/drop4/js/layout.js`、`games/drop4/js/ui.js`、`core/pointer.js`
- Test: `tests/drop4/layout.test.js`、`tests/core/pointer.test.js`

**Interfaces:**
- Consumes: Controller、CharacterView、UI.header、Characters
- Produces:
  - `Ailand.games.drop4.Layout.compute({width, height, cols, rows, players}) → {orientation:'portrait'|'landscape', cell:number, boardW, boardH, colHit:number}`（純関数。cell は盤が残りの領域に収まる最大の整数 px、colHit は列の当たり幅＝cell＋gap）
  - `Ailand.core.Pointer.classify(down, up) → 'tap'|'cancel'`（同じ pointerId、移動 ≤ 12px、時間 ≤ 800ms で tap）と `Pointer.attach(el, {onHover(x,y,type), onTap(x,y,type), onLeave()}) → detach`
  - `Ailand.games.drop4.UI.init(root, controller)`（設定画面と対局画面の切替。設定は要件 3.7 の6パネル。操作は要件 3.8）

- [ ] **Step 1: 失敗するテスト**
  - layout：390×844・7×6 で portrait、`cell*7 <= 390-32`。844×390 で landscape。10×8 を 390×844 に入れても盤が画面内、colHit ≥ cell。サイズ変更で再計算した結果が新しい寸法に合う（Review Focus 4）。
  - pointer.classify：移動 13px は cancel、別 pointerId は cancel。
- [ ] **Step 2:** FAIL → **Step 3:** 実装：
  - 設定画面（要件 3.7）。前回設定は `ailand:drop4:settings.v1`。キャラ重複不可。「つづきから」は `controller.hasSave()`。
  - 対局画面（設計書 §6.6 のレイアウトと色）。背景は水色系（`--page-bg: #e8f6ff`、水玉 `#cdeaff`）、盤 `#5b8cff`。コマの色と記号は設計書 §6.6。
  - 入力（要件 3.8）：mouse は hover でゴースト、クリック1回で落とす。touch/pen は1回目でゴースト、同じ列の2回目で落とす。切り替えボタン「おとす／ぬく／ブロック のこりN」。`controller.isBusy()` 中と落下アニメーション中は入力を無視（Review Focus 3）。`resize`/`orientationchange` で Layout を再計算しゴーストを解除（Review Focus 4）。
  - 「1手もどす」ボタンは `undoLeft()>0` かつ人間1人のときだけ表示。
- [ ] **Step 4:** PASS。Browser pane で 390×844・844×390・1024×768・1280×800 を撮影し、盤全体が1画面に収まること、ボタンが 64px 以上、コンソールエラー0件。
- [ ] **Step 5:** コミット：`feat: ぽとん4 の設定画面と対局画面を追加`。

### Task 15: 演出（core/effects.js と ぽとん4 の演出）

**Files:**
- Create: `core/effects.js`、`css/effects.css`、`games/drop4/js/fx.js`
- Test: `tests/core/effects.test.js`（純粋部分のみ）

**Interfaces:**
- Consumes: Task 13 の `reaction` / `gameover` イベント、`EmotionMap.resolve`、`CharacterView.apply`
- Produces:
  - `Ailand.core.Effects.isReduced() → boolean`、`particlesFor(kind, reduced) → number`（上限 40、reduced で 1/4）、`burst(layer, kind)`（`confetti|sparkle`）、`shake(el)`（reduced では何もしない）、`ring(el)`、`mark(el, kind)`（`sweat|bang|sparkle|zzz|steam`）、`bubble(slot, text, ms)`、`thinking(slot, on)`
  - `Ailand.games.drop4.Fx.play(picked, ctx)`：reach＝「！」と光、block＝盾のマーク＋ring、double＝sparkle、endgame＝なし（BGM 側）、win＝勝ちコマに ring＋勝者キャラを中央に大きく（幅 60%）跳ねる・回る＋confetti、lose＝暗めのやさしい表示（紙吹雪なし）、draw＝やさしい表示。顔は全員分 `CharacterView.apply`＋`mark`。
  - 落下アニメーション：CSS transform で落下し2回はねる。`Fx.drop(discEl, rows) → Promise`（reduced では即 resolve）。

- [ ] **Step 1:** 失敗するテスト：`particlesFor('confetti', false) <= 40`、`particlesFor('confetti', true) <= 10`。
- [ ] **Step 2:** FAIL → **Step 3:** 実装（移植元 `js/ui/effects.js` と `css/effects.css` の汎用部を、固定セレクタを引数に変えて移す）→ **Step 4:** PASS。
- [ ] **Step 5:** Browser pane で各演出を呼び出して撮影（390×844）。reduced-motion エミュレートで揺れ・跳ねが止まり、表情と静止表示だけになること。
- [ ] **Step 6:** コミット：`feat: 共通演出とぽとん4 の演出を追加`。

### Task 16: 音（core/sound.js・core/bgm.js・ぽとん4 の音色）

**Files:**
- Create: `core/sound.js`、`core/bgm.js`、`games/drop4/js/sounds.js`
- Test: `tests/core/sound.test.js`、`tests/core/bgm.test.js`

**Interfaces:**
- Produces:
  - `Ailand.core.Sound`：`unlock()`、`setEnabled(b)`、`isEnabled()`、`register(name, fn(ctx, dest, t, opts))`、`play(name, opts)`、`setVolumes({se, bgm})`、`bgmDest() → AudioNode|null`。設定は `Storage.create('core')` の `settings.v1` = `{sound:boolean}`。
  - `Ailand.core.Bgm`：`notesBetween(score, bpm, fromBeat, toBeat) → [{beat, freq, len}]`（純関数）、`start(score)`、`stop()`、`setTempo(bpm)`。score = `{bpm, wave, bass, steps:[[freq|0, beats], ...]}`。lookahead 100ms で先読み予約。
  - drop4 の音名：`drop, pop, reach, block, double, win, lose, draw, button`。BGM の score：`NORMAL`（120bpm）、終盤は `setTempo(150)`。音の中身は設計書 §6.7。

- [ ] **Step 1: 失敗するテスト**
  - bgm.notesBetween：8拍のループで 7.5〜8.5 拍を求めると先頭に戻った音が入る。テンポ変更後も拍の位置が連続する。
  - sound：AudioContext が無い（Node）・suspended・`setEnabled(false)` で `play`・`Bgm.start`・`setTempo` を呼んでも例外なし（Review Focus 5）。
  - `register` した名前以外の `play` は何もしない。
- [ ] **Step 2:** FAIL → **Step 3:** 実装（note/seq/エンベロープは移植元 `js/audio/sound-synthesizer.js:12-30` と同じ形、SE と BGM に別 GainNode、BGM は SE の半分）→ **Step 4:** PASS。
- [ ] **Step 5:** コミット：`feat: 共通の音と BGM、ぽとん4 の音色を追加`。

### Task 17: ぽとん4 の統合と静的検査の仕上げ

**Files:**
- Create: `games/drop4/js/main.js`
- Modify: `games/drop4/index.html`（script 順）、`tests/static-check.js`、`tests/test.html`、`README.md`（あいランド用に書き換え。見出し「わくわく！あいランド」、実行例は `scripts\run.bat` 形式）、`CHANGELOG.md`

**Interfaces:**
- Consumes: Task 4〜16 のすべて

- [ ] **Step 1:** `main.js` で配線：bus → UI、controller.reaction → Fx.play＋Sound.play＋セリフ吹き出し、thinking → 「うーん」と考え中ドット、endgame → `Bgm.setTempo(150)`、gameover → 勝ち・負け・引き分けの音と演出、最初の pointerdown で `Sound.unlock()`、ヘッダー（もどる＝`../../index.html`、おと＝Sound と BGM の ON/OFF、せってい＝モーダル「はじめから／せっていにもどる／BGM ON・OFF」）。
- [ ] **Step 2:** static-check に追加：`getImageData` の禁止。`localStorage` の直接使用は `core/storage.js` と `games/othello/js/core/storage.js` 以外で禁止。全ページの `data-base` と画像参照の解決。`tests/test.html` に載っていない `*.test.js` があれば問題として出す。
- [ ] **Step 3:** `scripts\run.bat check` → 0件、`test` → 全件 PASS、`replay-othello` → 一致。
- [ ] **Step 4:** Browser pane（file:// と `scripts\run.bat serve` の両方）で入口 → ぽとん4 → 2人 CPU「よわい」で最後まで → 入口 → オセロっち → 入口。4人チーム戦（CPU 混在）を最後まで。各ページでコンソールエラー0件。
- [ ] **Step 5:** コミット：`feat: ぽとん4 を統合し静的検査を仕上げる`。

### Task 18: 検証レポートと手動テスト依頼

**Files:**
- Create: `.claude/docs/reports/2026-11-08-ailand-phase1-verification.md`、`.claude/docs/reports/2026-11-08-ailand-phase1-manual-test.md`

- [ ] **Step 1:** 検証項目をすべて実行して記録する：
  - `scripts\run.bat test`（件数、移植元テストを含むこと）
  - `scripts\run.bat check`（0件、`type="module"`・`fetch(`・外部 URL・大文字小文字不一致が無いこと）
  - 入口・オセロっち・ぽとん4 を file:// と serve の両方で開いてコンソールエラー0件
  - `scripts\run.bat replay-othello`（組数・一致数・偽時計の刻み・組を減らしたか）
  - ぽとん4 の機能テスト一覧（縦・横・斜め2方向、満杯列、引き分け、3人・4人巡回、チーム戦、ぬきとり、おじゃまブロック、中断・再開）とテスト名の対応
  - `scripts\run.bat measure-drop4` の結果（各勝率、「ふつう」の1手の最大思考時間、目標 500ms 以内）
  - localStorage のキー：全 js から `Storage.create(` の gameId と othello の SAVE_KEY/SETTINGS_KEY を grep し、すべて `ailand:` で始まること
  - 画像サイズ合計（縮小前・後）
- [ ] **Step 2:** 手動テスト依頼書（設計の manual_test_checklist 7項目を、手順と期待結果つきで）を書き、ユーザーに渡す。結果を受け取るまで完了宣言しない。
- [ ] **Step 3:** コミット：`docs: Phase 1 の検証レポートと手動テスト依頼を追加`。
