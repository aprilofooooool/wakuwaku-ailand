# Phase 1 検証レポート（2026-11-08）

## 1. 自動検証の実行結果

| 項目 | コマンド | 結果（出力そのまま） |
|---|---|---|
| 単体テスト | `scripts\run.bat test` | `passed 407 / failed 0`（移植元オセロっちの 212 件を含む） |
| 静的チェック | `scripts\run.bat check` | `static-check OK (0 violations)`（`type="module"`・`fetch(`・外部 URL・ファイル名の大文字小文字不一致なし） |
| オセロ再生比較 | `scripts\run.bat replay-othello` | `replay: 95/95 match (232.1s)` |
| ぽとん4 強さ計測 | `scripts\run.bat measure-drop4`（引数なし、seed 1） | 下表 |

### オセロ再生比較の方法
- 移植元と同じ条件で 95 組（レベル・先手・盤の組み合わせ）を最後まで打たせ、手の記録を JSON（`tests/golden/othello-replay.json`）と完全一致で比べる。
- 偽時計の刻みは 10 ms（Ruling R8。ブリーフの 0.05 ms では一部の組が 8 分を超えたため。刻みは golden に保存済み。`tests/tools/replay-othello.js:30`）。
- 組は減らしていない（95 組すべて一致）。

### measure-drop4 の結果（`constants.js` 現行値、200 局／つよいは 100 局）

| 組 | 結果 | 目標 |
|---|---|---|
| よわい vs 子ども役 | 子ども役 75.0% | 70〜80% 達成 |
| ふつう vs 子ども役 | 子ども役 49.0% | 45〜55% 達成 |
| つよい vs 子ども役 | 子ども役 0.0% | 目標なし（Ruling R14: ママが勝てるかは手動テスト 9） |
| つよい vs ふつう | つよい 100.0% | 80% 以上 達成 |
| ふつう 1手の思考時間 | 最大 3.8 ms・平均 1.0 ms（2185 手） | 500 ms 以内 達成 |
| つよい 1手の思考時間 | 最大 400.7 ms・平均 255.8 ms（1419 手） | 予算 400 ms |

「ふつう」は R12（見落とし確率 0.7）で調整済み。

## 2. ブラウザのコンソールエラー
このセッションではブラウザを使えないため、コントローラーの記録（`.superpowers/sdd/2026-11-08-ailand-phase1/progress.md`）を根拠にする。

| 対象 | 方法 | 結果 |
|---|---|---|
| 入口・オセロっち・ぽとん4 | `http://localhost:8080`（serve） | コンソールエラー 0 件（Task 3 / 6 / 17 の確認） |
| ぽとん4 4人チーム戦 | 同上、最後まで遊んだ | 完走、エラー 0 件（Task 17） |
| 縦・横レイアウト、勝利演出 | 同上 390x844 / 844x390 / 1024x768 | 盤が収まり重なりなし（Task 6 / 14 / 15） |
| file:// | 自動化できない（Ruling R18） | 未実施。手動テスト 8 に回した |

## 3. ぽとん4 の機能とテスト名

| 機能 | テスト（`it(...)`） | ファイル:行 |
|---|---|---|
| 縦4つ | `vertical` | tests/drop4/engine.test.js:82 |
| 横4つ | `horizontal` | tests/drop4/engine.test.js:90 |
| 斜め（右上） | `diagonal up-right` | tests/drop4/engine.test.js:95 |
| 斜め（右下） | `diagonal down-right` | tests/drop4/engine.test.js:101 |
| 満杯の列 | `full column is illegal` | tests/drop4/engine.test.js:62 |
| 引き分け | `full board draws` / `draw by move limit` | tests/drop4/engine.test.js:128 / 136 |
| 3人・4人の順番 | `turn order`（3人 [2,3,1]、4人 [1,2,3,4]） | tests/drop4/engine.test.js:40 |
| チーム戦の勝ち | `team win mixes seats 1 and 3` | tests/drop4/engine.test.js:119 |
| ぬきとり | `pop only on columns whose bottom is own colour` / `pop lowers the column by one and empties the top` / `team mode: popper team wins over the other team, seats mix` | tests/drop4/engine-options.test.js:31 / 39 / 81 |
| おじゃまブロック | `each seat starts with 2 and block lowers only the mover count` / `block moves are listed until the stock is 0` / `a block cannot be popped` | tests/drop4/engine-options.test.js:115 / 124 / 146 |
| 中断・再開 | `saves each move and resumes the same position` / `resume with a CPU turn pending restarts the CPU` / `bad saves: resume false, save removed, no throw` | tests/drop4/controller.test.js:157 / 172 / 182 |

## 4. localStorage のキー
`grep -rn "Storage.create(\|SAVE_KEY\|SETTINGS_KEY\|ailand:" games core` の結果。すべて `ailand:` で始まる。

| 場所 | キー |
|---|---|
| core/storage.js:13 | 接頭辞 `'ailand:' + gameId + ':'`（`Storage.create` はこの接頭辞を必ず付ける） |
| games/drop4/js/main.js:19 | `Storage.create('drop4')` → `ailand:drop4:*`（保存 `save.v1`・設定 `settings.v1`、controller.js:7-8） |
| games/drop4/js/ui.js:19、core/sound.js:10 | `Storage.create('core')` → `ailand:core:settings.v1` |
| games/othello/js/config/constants.js:46 | `SAVE_KEY: 'ailand:othello:save.v1'` |
| games/othello/js/config/constants.js:55 | `SETTINGS_KEY: 'ailand:othello:settings.v1'` |
| core/games.js:6-7 | `hasSave` 用に `ailand:drop4:save.v1` / `ailand:othello:save.v1` |

旧キー `otc.save.v1` / `otc.settings.v1` はコードに出てこない（読まない・書かない・消さない）。

## 5. 画像サイズ（`assets-src` と `assets` の PNG 24 枚、再計測）

| | 合計 | 最大 1 枚 |
|---|---|---|
| 縮小前（assets-src） | 20,774,979 bytes | 1,116,903 bytes |
| 縮小後（assets） | 3,587,169 bytes | 197,893 bytes |

Task 7 の記録と一致。

## 6. 未了・注意
- 手動テスト（iPhone / iPad / PC 実機）は未実施。依頼書は `.claude/docs/reports/2026-11-08-ailand-phase1-manual-test.md`。結果を受け取るまで完了宣言しない。
- 「つよい」は子ども役に 100% 勝つ（R14）。ママが勝てるかは実機で確認する。
- 列のタップ幅は縦で約 50px・横向きで約 40px（R17）。
- 実機確認のための公開方法は未決（serve は 127.0.0.1 のみ、`tests/tools/serve.js:17`）。
