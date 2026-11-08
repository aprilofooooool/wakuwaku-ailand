# わくわく！あいランド Phase 1 設計書

- 作成日：2026-11-08
- 状態：brainstorming で合意した設計（ユーザー承認待ち）
- 仕様の正：`.claude/docs/specs/2026-11-08-ailand-requirements.md`（以下「要件」）。本書は要件をどう作るかを書く。
- 移植元：`aprilofooooool/flipflip-othello` コミット `e342642`（読み取り用 clone は `../flipflip-othello-src`。移植元には書き込まない）

## 1. Phase 1 の範囲

1. 新リポジトリ `wakuwaku-ailand` の土台（入口ページ＋`core/`＋`games/<id>/`）。
2. オセロっちの移植（遊び心地と全機能を保つ。既存テスト全件成功）。
3. 新作「ぽとん4」。
4. 後続5本を `core/` をほぼ触らずに足せる構成（部品は作らず、置き場所と形を決めるだけ。§9）。

範囲外：後続5本の実装、オンライン対戦、PWA・Service Worker、GitHub への push と Pages 設定、移植元への変更、オセロっちの操作方式の作り直し（要件 D7）。

## 2. 移植元との差分（調査結果の要点）

| 項目 | 移植元 | Phase 1 での扱い |
|---|---|---|
| 名前空間 | `window.Otc` | `window.Ailand`。オセロは `Ailand.games.othello`（以下 `O`）へ |
| 構成 | `js/{core,config,data,engine,game,audio,ui}/` に全部 | 共通は `core/`、オセロ固有は `games/othello/js/` |
| 保存キー | `otc.save.v1` / `otc.settings.v1` | `ailand:othello:save.v1` / `ailand:othello:settings.v1`。旧キーは読まない・書かない・消さない |
| 入力 | click、`touch-action: manipulation`、48px | オセロはそのまま。ぽとん4・入口・共通ヘッダーは Pointer Events、`none`、64px |
| 音 | `Otc.Sound`（効果音のみ、マスター音量1つ） | `core/sound.js` に合成部品と効果音/BGM の音量分離。オセロの音色表はオセロ側に残す |
| BGM | なし | `core/bgm.js`（ぽとん4 が使う。オセロには付けない） |
| batch 処理 | `js/main.js:32-45` で感情イベントを溜めて1つ選ぶ | `core/reaction.js` に一般化してぽとん4 が使う。オセロは main.js の処理をそのまま残す（§4.3） |
| キャラとセリフ | キャラ定義の中に `lines` | 新規ゲームは core のプロフィール＋ゲーム別セリフ。オセロは自前の定義のまま（§4.3） |
| 表情 | 6種＋`face` の顔文字フォールバック | `core/emotion-map.js` で論理表情を読み替え、`core/character-view.js` で画像解決 |
| テスト | `tests/test.html` の script 一覧を `tests/run-node.js` が vm で実行 | 同じ方式を維持し、一覧に core・othello・drop4 を並べる |
| 起動コマンド | `node tests/run-node.js` など直書き | `scripts\run.bat <test|check|serve|resize-images>` |
| 画像 | 1264px 原寸 24枚・約 20MB を直接表示 | 原寸は `assets-src/`、表示用 512px を `assets/` |

## 3. フォルダ構成

```
index.html                     入口（ロゴ＋ゲームカード）
css/
  theme.css                    共通の変数（形・影・フォント・共通色）。ゲームごとの背景色は各ゲームの CSS で上書き
  base.css                     リセット・ボタン・パネル・モーダル・reduced-motion
  header.css                   共通ヘッダー
  effects.css                  共通演出（紙吹雪・揺れ・光の輪・マーク・吹き出し）
  top.css                      入口ページ（ロゴ・カード）
core/
  namespace.js                 window.Ailand = { core: {}, games: {} }
  event-bus.js                 Ailand.core.EventBus（移植元 event-bus を移動）
  storage.js                   Ailand.core.Storage（キー接頭辞 'ailand:' を強制）
  characters.js                Ailand.core.Characters（プロフィール：id, name, colors, image, face, voice）
  common-lines.js              Ailand.core.CommonLines（セリフ未定義時の汎用セリフ）
  line-picker.js               Ailand.core.LinePicker（ゲーム別セリフ→汎用の順で引く。直前と同じ行を避ける）
  emotion-map.js               Ailand.core.EmotionMap（要件 1.5 の表）
  character-view.js            Ailand.core.CharacterView（画像候補・onerror フォールバック・色つき円＋顔文字）
  effects.js                   Ailand.core.Effects（紙吹雪・揺れ・光の輪・マーク・吹き出し・考え中ドット）
  sound.js                     Ailand.core.Sound（note/seq/エンベロープ、unlock、ON/OFF、SE/BGM の GainNode 分離、音色表の登録）
  bgm.js                       Ailand.core.Bgm（旋律ループ、テンポ変更）
  reaction.js                  Ailand.core.Reaction（1手の感情イベントを溜めて1つ選ぶ）
  pointer.js                   Ailand.core.Pointer（pointerId 追跡、要素内座標、hover/press の区別）
  ui-common.js                 Ailand.core.UI（共通ヘッダー、モーダル、トースト）
  rng.js                       Ailand.core.Rng（mulberry32。テストと CPU で共用）
games/
  othello/
    index.html
    css/                       game.css・top.css（移植元）と背景色の上書き
    js/                        移植元 js/ のうちオセロ固有（config, data, engine, game, audio の音色表, ui, main.js）
  drop4/
    index.html
    css/drop4.css
    js/
      constants.js             盤サイズ・待ち時間・色・調整値
      lines.js                 セリフ（Ailand.games.drop4.Lines）
      engine.js                ルール（純関数）
      ai.js                    CPU
      reactions.js             演出イベントの判定（純関数）
      controller.js            対局進行（DOM 非依存、bus に emit）
      sounds.js                音色表と BGM の楽譜
      ui.js                    設定画面と対局画面
      main.js                  配線
assets/characters/<id>/        512px 透過 PNG（表示用）
assets-src/characters/<id>/    元画像 1264px（ゲームからは読まない）
tools/resize-images/resize-images.ps1
scripts/run.bat
tests/
  test.html                    全テストの script 一覧（Node と ブラウザで共用）
  run-node.js                  移植元を名前空間だけ置き換えて流用
  test-runner.js               Ailand.Test
  static-check.js              検査対象を core/ と games/ に拡張
  core/*.test.js
  othello/*.test.js            移植元のテスト
  drop4/*.test.js
  tools/serve.js               移植元を流用（127.0.0.1 のみ）
  tools/replay-othello.js      移植前後の一致確認（§4.4）
  golden/othello-replay.json
.claude/docs/legacy-othello/   移植元 .claude/docs/ のコピー（D2）
```

- 各ゲームは独立した HTML ページ。入口からは普通の `<a href="games/drop4/index.html">` で遷移する。
- ゲームページは `<html data-base="../../">` を持ち、`core/character-view.js` は画像パスの頭にこの値を付ける。入口ページは `data-base="./"`。
- オセロの `games/othello/js/` 内の構成は移植元の `js/` のサブフォルダ構成をそのまま保つ（差分を小さくするため）。

## 4. オセロっちの移植手順

### 4.1 コミット1：無改変の取り込み

- `git init` し、移植元 `e342642` の作業ツリー（`.git` を除く）をそのままコピーしてコミットする。メッセージ：`chore: flipflip-othello e342642 を取り込み`。
- 作業フォルダには先にあいランドの文書（要件・本書・`logo-drafts/`・`ui-drafts/`）がある。コミット1には移植元由来のファイルだけを `git add` し、あいランドの文書は別コミット（`docs: あいランドの要件と設計を追加`）にする。
- この時点で `node tests/run-node.js` と `node tests/static-check.js` が全件成功することを確認する（`scripts\run.bat` はまだ無いので直接実行。これは取り込み確認のための1回限りの例外）。

### 4.2 コミット2：基準の記録

- `tests/tools/replay-othello.js` を追加し、移植前のコードで基準ファイル `tests/golden/othello-replay.json` を作る（§4.4）。
- `scripts/run.bat` を追加する。

### 4.3 コミット3以降：配置換えと core 切り出し

1. 移植元由来の `.claude/docs/{specs,plans,reports,research}/` の各ファイルだけを `.claude/docs/legacy-othello/` の同名サブフォルダへ `git mv` する（コミット1に入ったファイルの一覧で対象を決める。あいランドの文書は動かさない。移植元は触らない）。
2. ファイル移動：`js/*` → `games/othello/js/*`、`css/game.css`・`css/top.css` → `games/othello/css/`、`index.html` → `games/othello/index.html`。
3. 名前空間置き換え：`Otc.` → `Ailand.games.othello.`。オセロは自分の event-bus・storage・line-picker・characters（セリフ入り）・sound-synthesizer を `games/othello/js/` に持ったまま使う（core へ乗せ替えない。根拠：要件4「ロジック変更をしない」。移植元の `line-picker.js:14` と `tests/characters.test.js:45-67` はキャラ定義内の `lines` を前提にしている）。保存キーだけは `Ailand.games.othello` の定数を書き換えて `ailand:othello:` にする。各ファイル冒頭で `var O = Ailand.games.othello;` のように別名を置くのは可（ロジック不変）。
   - 結果として、キャラを追加するときはオセロの `characters.js` にも1エントリ（セリフ入り）を足す必要が残る。オセロの core への乗せ替えは Phase 2 以降の別作業とする（本書作成者の判断）。
4. 保存キーを `ailand:othello:save.v1` / `ailand:othello:settings.v1` に変える。
5. 画像パス：キャラ定義の `image.dir` は `assets/characters/<id>/` のまま（相対）、ページの `data-base` で解決する。
6. 共通ヘッダーを `games/othello/index.html` に付ける。「もどる」は入口へ、「おと」は `Ailand.core.Sound` の ON/OFF とオセロの既存サウンド設定を同期、「せってい」はオセロの既存設定画面（トップ画面）に戻る動作。
7. 各ステップの後に `scripts\run.bat test` と `check` と replay 比較が緑であることを確認してコミットする。
8. オセロの batch 処理（`main.js:32-45`）は置き換えず、main.js にそのまま残す（replay は controller だけを動かすので、batch の置き換えを検証できないため）。`core/reaction.js` はぽとん4 から使い始める。

### 4.4 移植前後の一致確認（replay）

- `tests/tools/replay-othello.js` は Node でオセロのスクリプトを vm に読み込み、`GameController` に mulberry32 の rng・即時実行の scheduler・メモリ storage を注入して、CPU 同士の対局を最後まで進める。
- 対局の組：`{solo, duo, four} × {8x8 標準, 8x8 アンチ, 6x6 標準, 6x6 アンチ（four は 8 のみ）} × CPU の強さ全種 × seed 1〜5`。人間席は「その局面の合法手を rng で選ぶ」入力で代用する。
- 時計：オセロの CPU は `performance.now()` の締め切りで探索を打ち切る（`reversi-ai.js:207,329,342`、`four-ai.js:78,135`）。replay では vm の `performance.now` を「呼ばれるたびに一定量（初期値 0.05ms）進む偽の時計」に差し替え、締め切りを決定的に到達させる。これで機械の速さに左右されず、実行時間も抑えられる。全組の実行が 5 分を超える場合は、組を強さ「つよい」の seed 1〜2 に減らし、減らしたことをレポートに書く。
- 記録するもの：各手の着手座標、最終盤面、全 `emotion` イベント（移植元の形 `{player, emotion}` のまま）の列、`gameover` の結果。
- 判定：移植前の記録（golden）と移植後の記録を JSON で完全一致比較する。結果は検証レポートに組数と一致数で書く。
- replay ツールは移植前後で読み込むファイルの一覧だけを切り替える（移植前の一覧をツール内に定数で持つ）。

## 5. core モジュールの形

すべて IIFE で `Ailand.core.<Name>` に登録する。DOM 非依存のもの（EventBus, Storage, Characters, CommonLines, LinePicker, EmotionMap, Reaction, Rng, Sound の音色登録部）は Node のテストで動かす。

| モジュール | 主な API | 根拠 |
|---|---|---|
| Storage | `create(gameId)` → `{get(key, fallback), set(key, v), remove(key), has(key)}`。実キーは `ailand:<gameId>:<key>`。`_backend` で差し替え可 | キー接頭辞の強制で要件 1.8 を構造で守る。オセロは自前の storage を使い続ける（§4.3） |
| Characters | `list()`、`get(id)`。プロフィールに `lines` は持たない | セリフはゲーム別（要件 1.4） |
| LinePicker | `create({gameLines, commonLines, rng})` → `pick(charId, situation)` | ゲーム別に無ければ汎用へ |
| EmotionMap | `resolve(logical)` → `{image, mark}`（mark は `null`/`sweat`/`bang`/`sparkle`/`zzz`/`steam`） | 要件 1.5 の表を1か所に |
| CharacterView | `candidates(char, logical)`、`apply(imgEl, char, logical)`、`renderFallback(el, char, logical)` | 移植元 character-manager の画像部分を一般化 |
| Effects | `burst(kind, opts)`、`shake(el)`、`ring(el)`、`mark(el, kind)`、`bubble(slot, text)`、`thinking(slot, on)`、`isReduced()` | 移植元 effects の汎用部。`#screen-game` 等の固定セレクタは引数で受ける |
| Sound | `unlock()`、`setEnabled(b)`、`isEnabled()`、`register(name, fn)`、`play(name, opts)`、`seGain`/`bgmGain` | 音色表はゲーム側で登録 |
| Bgm | `play(score)`、`stop()`、`setTempo(bpm)`。score は `{bpm, steps:[[freq|0, len], ...], wave}` の配列 | 旋律ループを先読みスケジューリング（lookahead 100ms） |
| Reaction | `create({priority, pickPerspective})` → `push(event)`、`flush()` → 選ばれた1件。同一タスク内のイベントを `setTimeout(0)` でまとめる | 移植元 main.js の batch を一般化 |
| Pointer | `attach(el, {onHover, onTap, onCancel})`。pointerId ごとに down→up を追跡し、移動量 12px 以内を tap とみなす。`pointerType` で mouse の hover を区別 | ぽとん4 の2タップとゴースト。後続でマルチタッチに拡張 |
| UI | `header({onBack, onSettings})`、`modal(title, nodes)`、`toast(text)` | 共通ヘッダー |
| Rng | `mulberry32(seed)` | テストと CPU で共用 |

## 6. ぽとん4 の設計

### 6.1 状態とエンジン（`engine.js`、純関数）

- 状態：`{cols, rows, cells: Int8Array(cols*rows), players: [{seat, team, blocksLeft}], turn, moveCount, popOut, blocks, teams, lastMove, result}`。セル値は `0` 空、`1..4` 席、`9` ブロック。`cells[c*rows + r]`（r=0 が一番下）で列を連続配置。
- API：`create(settings)`、`legalMoves(state)`（`{type:'drop'|'pop'|'block', col}`）、`apply(state, move)`（新しい状態を返す）、`winnersAfter(state)`、`isDraw(state)`、`immediateWins(state, seatOrTeam)`（いま置けるそろうマスの列一覧）。
- 勝ち判定：最後に変化した列の周辺だけ4方向（横・縦・斜め2）を数える。ぬきとり後は列全体が動くので、その列の全マスを起点に判定する。チーム戦は同じチームの席を同一視して数える。
- 引き分け：満杯、または `moveCount >= cols*rows*2`（要件 3.5）。
- 同時成立の勝者決定（要件 3.3）：抜いた人（のチーム）がそろっていれば抜いた人。いなければ、抜いた人の次の席から順に見て最初にそろっている人。

### 6.2 CPU（`ai.js`）

- 2人：負ける手を除き、αβ探索（negamax）＋評価関数。評価は「3つ並び＋空き1」「2つ並び＋空き2」の窓の数を重み付けし、中央列を加点。
- 3〜4人：paranoid 探索（自分以外を1チームとみなす）で深さを浅く。チーム戦はチーム単位で評価。
- 強さ：

| 強さ | 方針（初期値。§6.3 の計測で調整） |
|---|---|
| よわい | すぐ勝てる手は 60% で打つ。相手のすぐ勝つ手は 30% で止める。それ以外はランダム（中央寄りの重み）。ブロックはほぼ使わない |
| ふつう | 深さ 4 の探索。評価に小さな乱数を足す。すぐ勝つ手・止める手は必ず打つ |
| つよい | 反復深化で 0.4 秒まで（2人は深さ最大 10、3〜4人は最大 5）。ブロックは相手のリーチを止める手の候補に含める |

- 思考はメインスレッドで、移植元 `reversi-ai.js` の `search(..., {scheduler})` と同じく一定ノードごとに `setTimeout` で区切る（Worker は使えないため）。
- 待ち時間：思考開始から最低 0.6 秒経ってから着手を反映する。

### 6.3 強さの調整方法

- 子ども役の簡易 CPU（`tests/tools/child-proxy.js`）：すぐ勝てる手があれば 80% で打つ、相手のすぐ勝つ手は 50% で止める、それ以外は中央寄りのランダム。
- `tests/tools/measure-drop4.js`：CPU 各強さと子ども役を 2人 7×6 で先後入れ替え 200 局ずつ対戦させ、子ども役の勝率を出す。
- 目標：よわい相手に子ども役の勝率 70〜80%、ふつう相手に 45〜55%。つよいは「ふつう」に 80% 以上勝つことを数値目標の代わりにする。
- 「ふつう」の1手の思考時間の最大値を同じツールで測る（目標 0.5 秒以内）。
- 結果は検証レポートに書く。子ども役の妥当性はユーザーの実機テスト（娘が遊んだ感想）で確かめる。

### 6.4 演出判定（`reactions.js`、純関数）

- 入力：着手前の状態、着手、着手後の状態。出力：イベントの配列 `{kind, seat, emotion, priority}`。
- 判定（要件 3.9）：
  - リーチ：着手後の `immediateWins(mover)` が1以上かつ着手前より増えた。
  - ダブルリーチ：着手後の `immediateWins(mover)` が2以上（リーチより優先）。
  - ブロック：着手前の相手の `immediateWins` に含まれる列に置いた（ブロック含む）。止められた側に anger。
  - 終盤：着手後の空きマス ≤ 盤の4分の1、かつ未発火。
  - 勝利・引き分け：エンジンの結果から。
- 全体の演出は `core/reaction.js` で優先順（勝利 → ダブルリーチ → ブロック → リーチ → 終盤 → place）と「人間側の視点」で1つ選ぶ。顔はイベントごとに全員分更新する。
- 終局の「人間側の視点」（本書作成者の判断。移植元 solo の「CPU が勝ったら負けの音」に合わせる）：
  - 勝者（チーム戦は勝ったチーム）に人間が1人でもいる → 勝利演出（紙吹雪・ファンファーレ・勝ったキャラを大きく表示）。
  - 勝者が CPU だけ → 負けの演出（紙吹雪なし、勝った CPU キャラは excited の顔だけ、人間キャラは sadness、負けの音）。
  - 引き分け → 引き分けの演出。
  - 対局中のできごと（リーチ等）は、人間が複数いるときは「打った人が人間ならその人、CPU なら被害を受けた人間のうち席順で最初の人」の視点で選ぶ。

### 6.5 対局進行（`controller.js`）

- 移植元 `game-controller.js` と同じく DOM を持たず、`deps = {rng, scheduler, storage, ai, linePicker}` を注入する。
- イベント：`started`、`turn`、`moved`、`reaction`、`thinking`、`gameover`、`undo`。
- 自動保存：着手・undo のたびに `ailand:drop4:save.v1` へ `{version:1, settings, history:[move...], undoLeft}` を書く。履歴は手の列だけを持ち、再開時に先頭から再生する（盤面を丸ごと保存しない。データが小さく、検証しやすい）。
- 設定の記憶：`ailand:drop4:settings.v1`。
- 「1手もどす」：人間が1人のときだけ。直前の人間の手番の直前まで戻す。1局3回。

### 6.6 画面（`ui.js`、`drop4.css`）

- 背景トーン：水色系（例 `--bg: #e8f6ff`、水玉 `#cdeaff`）、盤は青（`#5b8cff`）。オセロっちのクリーム色と区別する。入口はラベンダー系（`#f3ecff`）。
- コマの色：P1 ピンク、P2 黄、P3 水色、P4 緑。見分けやすくするため、コマの中に白い記号（♥ ★ ● ◆）を付ける。チーム戦は A＝ピンク・うすピンク、B＝水色・うす水色（記号は席ごと）。
- レイアウト：iPhone 縦は「ヘッダー → キャラ列（全員）→ ゴースト行 → 盤 → 切り替えボタン」。横向き（iPad 横・iPhone 横）は「キャラ列を左右に分け、中央に盤」。盤は `min(幅, 高さの残り)` から1マスの大きさを計算する。
- 落下アニメーション：CSS transform で上から落とし、2回はねる（reduced-motion 時は即座に置く）。落下音は1回目と2回目の接地に合わせる。
- 勝利演出：そろった4つ（以上）のコマに光の輪、勝ったキャラを中央に大きく（画面幅の 60%）、跳ねる＋回る＋キラキラ、紙吹雪、ファンファーレ。

### 6.7 音（`sounds.js`）

| 名前 | 音の設計（初期案） |
|---|---|
| drop | sine で 520Hz→260Hz を 80ms、60ms 後に小さく同じ形（2回目のバウンド） |
| pop | 上がる短い「すぽっ」（triangle 300→700Hz） |
| reach | triangle で上がる3音（ド・ミ・ソ） |
| block | 低い square の「どん」＋高い sine の「キン」 |
| double | 速い上昇アルペジオ5音＋高音のきらめき |
| win | 長調のファンファーレ（6音） |
| lose | ゆっくり下がる2音（やさしく） |
| draw | 同じ高さの2音を2回 |
| BGM 通常 | 120bpm、ペンタトニックの明るい8小節ループ（triangle の旋律＋sine のベース） |
| BGM 終盤 | 同じ旋律を 150bpm |

- 既定：効果音 ON、BGM ON（BGM の音量は効果音の半分）。共通ヘッダー「おと」で全体を ON/OFF（設定は `ailand:core:settings.v1`）。

### 6.8 セリフ（`lines.js`）

- 状況：`start`、`reach`、`reached`（相手にリーチされた）、`block`、`blocked`、`double`、`doubled`、`endgame`、`win`、`lose`、`draw`、`thinking`。
- 4キャラ × 12状況 × 3種類以上。20文字以内。口調は `legacy-othello/research/2026-10-29-character-voice.md` とキャラの `voice` に合わせる。テストで文字数・件数を検査する。

## 7. 入口ページ

- ロゴ：`.claude/docs/specs/logo-drafts/logo-v2.html` の B を本番用に整える（`css/top.css`）。
- カード：ぽとん4・オセロっち（押せる）、5本の「じゅんびちゅう」（押せない、`aria-disabled="true"`、薄い色）。カードの絵は CSS と inline SVG。
- 中断データがあるゲームのカードには「つづきから」バッジを出す（各ゲームの保存キーの有無だけを見る）。

## 8. 開発コマンドとテスト

`scripts\run.bat <サブコマンド>`（UTF-8 化してから実行する）

| サブコマンド | 実行内容 |
|---|---|
| `test` | `node tests\run-node.js` |
| `check` | `node tests\static-check.js` |
| `serve` | `node tests\tools\serve.js 8080` |
| `resize-images` | `powershell -NoProfile -ExecutionPolicy Bypass -File tools\resize-images\resize-images.ps1` |
| `measure-drop4` | `node tests\tools\measure-drop4.js`（§6.3） |
| `replay-othello` | `node tests\tools\replay-othello.js`（§4.4） |

- static-check の拡張：対象に入口・`games/*/index.html`・`core/`・`games/` 配下の css/js を加える。禁止パターン（`type="module"`、`import`/`export`、`fetch(`、`XMLHttpRequest`、`new Worker(`、外部 URL、`getImageData`）。参照の存在と大文字小文字の一致。名前規則。localStorage の直接使用は `core/storage.js` 以外で禁止。
- TDD の対象：drop4 のエンジン・AI・演出判定・コントローラ（保存・再開・undo）、core の Storage・EmotionMap・LinePicker・Reaction・Rng・CharacterView の候補計算、画像縮小ツールの出力（サイズと透過の有無を PowerShell で読み取って確認）。

## 9. 後続ゲームが使う予定の部品（Phase 1 では作らない）

| 部品（予定の置き場） | 使うゲーム | 中身 |
|---|---|---|
| `core/loop.js` | 落ちブロック、落ちもの連鎖、キャラたたき | requestAnimationFrame の固定間隔更新、一時停止（タブ非表示で止める） |
| `core/canvas-view.js` | 落ちブロック、落ちもの連鎖 | devicePixelRatio 対応、キャラ画像の描画（読み出しはしない） |
| `core/pointer.js` の拡張 | キャラたたき | 複数 pointerId の同時 tap、画面の左右分割 |
| `core/drag.js` | ピース埋め、ピース陣取り | pointer capture でのドラッグ、マス目への吸着、回転・反転ボタン |
| `core/grid.js` | ピース埋め、ピース陣取り、落ち物 | ポリオミノの回転・反転・当たり判定 |

- 追加の手順：`games/<id>/` を作り、入口のカードを押せるようにし、`tests/test.html` に読み込みを足す。`core/` への変更は上の部品の追加だけで済む見込み。

## 10. 実装者に任せたこと（本書作成者の判断として明記）

- 背景色・コマの色と記号、音色・旋律・テンポの具体値（§6.6、§6.7）。
- CPU の初期パラメータと子ども役の定義（§6.2、§6.3）。値は計測で調整する。
- 3〜4人のぬきとりで、抜いた人以外の複数人が同時にそろった場合の勝者（要件 3.3）。
- 「1手もどす」は人間1人のときだけ（要件 3.8）。
- CPU の強さは全 CPU 共通（要件 3.6）。
- 後続5本の仮名と概要（要件 5）。
- オセロはキャラ定義・セリフ・batch 処理・storage を core へ乗せ替えない（§4.3）。
- 終局と対局中の「人間側の視点」の決め方（§6.4）。
- replay の偽の時計（§4.4）。
