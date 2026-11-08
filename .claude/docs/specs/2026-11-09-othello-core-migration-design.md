# オセロっち core 乗せ替え・操作共通化・音設定一本化 設計

- 日付: 2026-11-09
- 対象: `games/othello/`、`core/`（必要最小限）
- backlog: D-1、U-1、Phase 1 手動テストの既知の不具合 (a)(b)
- 正: 要件 `.claude/docs/specs/2026-11-08-ailand-requirements.md`（1.2 操作規約）、Phase 1 設計 `.claude/docs/specs/2026-11-08-ailand-phase1-design.md` §4.3

## 1. 目的（なぜ）

1. キャラを1人増やすときに「画像＋`core/characters.js` に1エントリ＋各ゲームのセリフ」で済むようにする。今はオセロっちだけがセリフ入りのキャラ定義を自前で持っており、二重管理になっている（D-1）。
2. オセロっちの操作をぽとん4と同じ共通規約にそろえ、iPhone・iPad での押しやすさを上げる（U-1）。
3. 音のオンオフを、入口とすべてのゲームで1つのフラグとして扱う（ユーザー決定、下記 §3）。あわせて既知の不具合2件を直す。

## 2. ゴール・やらないこと・失敗とみなすこと

- ゴール
  - オセロっちのキャラ定義は `core/characters.js` を使い、セリフは `games/othello/js/data/lines.js`（ぽとん4 の `games/drop4/js/lines.js` と同じ形 `Lines[charId][situation] = string[]`）に分ける。
  - 保存・イベントバス・セリフ選び・1手ぶんの演出まとめ（batch）を `core/` の部品で行い、オセロっち専用の同等部品（`games/othello/js/core/storage.js`、`event-bus.js`、`game/line-picker.js`）を削除する。
  - 音のオンオフは `ailand:core:settings.v1` の `sound` だけで決まる。
  - 不具合 (a)(b) が直る。
  - U-1 の規約（§5）を満たす。
- やらないこと
  - 対局ロジック（engine・AI・reaction-engine の感情判定・game-controller の進行）の変更。
  - 効果音の音色・BGM の曲の変更。`sound-synthesizer.js`（効果音の合成）と `othello-bgm.js` は残す（core の Sound への音色移植はしない）。
  - 画面の見た目の作り直し（大きさ・文字の拡大に伴う配置の調整だけ行う）。
- 失敗とみなすこと（テストが緑でもだめ）
  - 遊び心地が変わる：同じ操作で CPU の手・セリフ・演出の順が変わる。`scripts\run.bat replay-othello` の golden（`tests/golden/othello-replay.json`）不一致がその検出手段。golden は再生成しない（必要ならユーザーに確認）。
  - 既存の保存データ（続きから・設定）が読めなくなる。
  - スマホで盤をなぞったときに画面がスクロール・拡大してしまう、またはボタンが押しにくくなる。

## 3. ユーザーが決めたこと

- 音のオンオフは入口・各ゲームを問わず1つのフラグ。どこで切り替えても他の画面に引き継がれる（トップでオフ→ゲームに入ってもオフ、ゲームでオン→トップに戻ってもオン）。
- 切り替えはどこからでもできる。ゲーム中に急に消したい場面がある（ゲーム中の「おと」ボタンは残す）。
- オセロっちのヘッダー「せってい」は、ぽとん4と同じ動きにする。

## 4. 部品ごとの設計

### 4.1 キャラ定義とセリフ（D-1）
- `games/othello/js/data/characters.js` を削除し、`games/othello/js/data/lines.js` を新設する（`O.Lines`）。situation 名はオセロの13種（gameStart, turnStart, thinking, goodMove, cornerTaken, cornerLost, manyFlipped, pass, losing, winning, win, lose, draw）のまま。セリフ文字列は今のファイルからそのまま移す（1文字も変えない）。
- `O.SITUATIONS` 相当の一覧は `data/lines.js` に置く。全キャラ `image.hasDisc` は false なので、石の画像（disc）対応は削除する。
- キャラ一覧は `Ailand.core.Characters` を使う。オセロだけで使っていた項目（例：`image.hasDisc`、`colors` のうちオセロ固有のもの）が core にない場合は、core のエントリに足す（全ゲーム共通の画像・色の属性として扱う）。core 側にない項目がオセロ固有の見た目設定なら、`games/othello/js/` 側に「キャラID→設定」の小さな表として置く。どちらにするかは項目ごとに builder が判断し、計画書に書く。
- 画像パスは core の `CharacterView.basePath()` を使う。そのため `games/othello/index.html` の `<html>` に `data-base="../../"` を付ける（`tests/static-check.js` の data-base 検査に合わせる）。
- セリフ選びは `Ailand.core.LinePicker.create({ gameLines: O.Lines, commonLines: <core の共通セリフ>, rng })`。オセロの全キャラ・全 situation にセリフがある間は、選ばれるセリフと乱数の消費順は今と同じ（実装を突き合わせ済み：選び方は同一、`prev >= length` の保護だけが増える）。
- キャラ追加時、オセロのセリフ未登録なら共通セリフ（なければ空）で動く。

### 4.2 保存（D-1）
- `Ailand.core.Storage.create('othello')` を使う。キーは `ailand:othello:save.v1`、`ailand:othello:settings.v1` で今と同じなので移行処理は不要。
- `games/othello/js/config/constants.js` の SAVE_KEY / SETTINGS_KEY は接頭辞なしの `save.v1` / `settings.v1` に変える（core が `ailand:othello:` を付ける）。
- `ailand:othello:settings.v1` の `sound` は今後読まない・書かない（§4.5）。他の項目はそのまま。既に保存されている `sound` は残っていても害はない（消す処理も入れない）。

### 4.3 イベントバス（D-1）
- `Ailand.core.EventBus.create()` で作ったバスを `O.bus` として持つ（API は同一 on/off/emit）。`games/othello/js/core/` は `namespace.js` だけ残し、`event-bus.js`・`storage.js` は削除する。

### 4.4 1手ぶんの演出まとめ（D-1）
- `main.js` の手書き batch（`setTimeout(…,0)` で感情イベントをまとめる処理）を `Ailand.core.Reaction.createBatcher` に置き換える。core の batcher は配列だけを渡すので、mover と勝敗（over）は「種類つきのイベント」として同じ配列に積み、flush 時に取り出す。
- どの演出を選ぶかは今の `O.Reaction.pickEffect` のまま使う（core の `Reaction.pick` とは判定の意味が違うため置き換えない。理由：遊び心地を変えない）。
- 結果として「1手に演出1つ・反応音1つ」と、その選ばれ方は変わらない。これを unit test で固定する（replay は main.js を読まないため）。

### 4.5 音のオンオフ一本化と不具合 (b)
- 正のフラグは `Ailand.core.Sound.isEnabled()`（`ailand:core:settings.v1`.sound）。
- core に「音の設定が変わったら知らせる」口を足す：`Ailand.core.Sound.onChange(fn)`（戻り値で購読解除）。`setEnabled` で値が変わったときに呼ぶ。
- 共通ヘッダー（`core/ui-common.js`）は `onChange` を購読して音アイコンを描き直す。これで、どこで切り替えてもヘッダーが正しい表示になる（不具合 (b)。ぽとん4・入口にも効く）。
- オセロっちのトップの「おとのオンオフ」・ゲーム中の「おと」・ヘッダーの音アイコンは、すべて `core.Sound.setEnabled(!isEnabled())` を呼ぶ。画面内のボタン表示も `onChange` で描き直す。
- オセロの効果音（`O.Sound`＝`sound-synthesizer.js`）は起動時と `onChange` で `core.Sound.isEnabled()` に合わせる。BGM（`BgmLink`）の「鳴らしたいか」の判定は `core.Sound.isEnabled() && core.Sound.isBgmOn()` にする（オセロ独自フラグを外す）。
- 更新直後の扱い（Claude の判断）：前にオセロっちだけ音を消していた人でも、共通の設定がオンなら音が出る。もう一度押せば以後は保たれる。

### 4.6 ヘッダー「せってい」と不具合 (a)
- ぽとん4の `openMenu`（`games/drop4/js/ui.js:246-274`）と同じ作り：`core.UI.modal('せってい', …)` を開く。
  - ゲーム中：「はじめから」（今の設定で始め直す）と「トップに もどる」のボタン＋BGM の ON/OFF。
  - トップ画面：BGM の ON/OFF だけ。
- BGM の ON/OFF は `core.Sound.setBgmOn` を使い、`BgmLink.sync()` で即反映する。
- 「はじめから」「トップに もどる」は、オセロのゲーム中操作ボタンに既にある同じ動作（確認ダイアログの有無を含む）を呼ぶ。新しい挙動は作らない（Claude の判断）。

## 5. 操作の共通規約（U-1）

- 盤：`Ailand.core.Pointer.attach(盤, { onTap })` でマスを判定する（ぽとん4と同じ。指を少し動かしても12px・800ms以内ならタップ）。盤に `touch-action: none`。
  - マスは `<button class="cell">` のまま残し、キーボード（Tab＋Enter）で置ける今の動きを保つ（Claude の判断。遊び心地を変えない）。マウス・指は Pointer の onTap だけで処理し、マスの `click` はキーボード由来（`event.detail === 0`）のときだけ処理して二重に置かないようにする。
- ボタン：ぽとん4と同じく `<button>` の `click` のまま（Claude の判断。ぽとん4の実装が共通規約の実例で、`click` はタップ・キーボードの両方で発火するため）。操作ボタン・選択肢ボタンに `touch-action: none`。
- タップ領域：盤のマス以外の押せる要素（ボタン・選択肢・キャラカード・モーダル内ボタンを含むすべて）は 64×64px 以上（`--tap-min` を 64px に。44px 直書きもなくす）。盤のマスは盤の大きさで決まるので対象外（Claude の判断。8×8 で 64px 以上にすると iPhone に入らない）。
- 文字：本文は 18px 以上。小さな補助表示（石の数のバッジなど、読む文章でないもの）は対象外とし、builder が一覧を計画書に書く。
- 基準幅は要件 1.2 の iPhone 縦（幅 390〜430px）。390px で、文字とボタンが大きくなってはみ出す所は配置を詰めるか2段にして収める（例：ゲーム中の操作ボタン6個＝64px×6＝384px は 390px に入るが余白がほぼないので、2段にするかは builder が実画面で判断）。
- 要件書 1.2 と D7 の「オセロっちの操作部分は今回変えない」は Phase 1 の決定なので、本設計で上書きしたことを要件書に1行追記する。

## 6. テスト・確認

- 段階ごとに `scripts\run.bat test`、`scripts\run.bat check`、`scripts\run.bat replay-othello`（約4分）が緑。
- オセロの読み込み構成が変わったら `tests/tools/replay-othello.js` の FILES/NS だけ直す。`tests/test.html` の script 一覧も直す。
- 新しく足す unit test：core `Sound.onChange`、ヘッダーの音アイコン追従（DOM テスト）、オセロのセリフが全キャラ×全 situation にあること、batch 置き換え後の「1手1演出」、オセロの効果音が core の sound に従うこと。
- 検証レポートを `.claude/docs/reports/` に残し、GUI 手動テスト（iPhone・iPad 実機、ブラウザ）をユーザーに依頼する。

## 7. builder に任せること
- 作業の順番と段階の切り方（各段階で replay を通すこと）。
- §4.1 の、オセロ固有の見た目項目の置き場所（項目ごと）。
- 18px 規約の対象外にする小さな表示の選定。
- はみ出し対策の具体的な配置。
