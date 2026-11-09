# backlog（未解決タスクの唯一の正）

## B-1 ブラウザでテストを開くと Node 専用の音テストが1件失敗する
- 現象：`tests/test.html` をブラウザで開くと「core/Sound without AudioContext (Node) > every API is a safe no-op」が失敗する（`scriptsun.bat test` は緑）。`AI.searchSync` の時間切れテストも時々失敗する。
- 原因：ブラウザには本物の AudioContext があり、Node 前提の期待値と合わない。AI のテストは実時間に依存する。main でも同じ（2026-11-09 確認）。
- 方針：ブラウザで動くときはその音テストを飛ばす（`data-browser-only` の逆の印を付ける等）。AI のテストは時間に余裕を持たせる。
- 関連：`tests/core/sound.test.js:63`、`tests/othello/ai.test.js`、`.claude/docs/reports/2026-11-09-othello-core-migration-verification.md`
