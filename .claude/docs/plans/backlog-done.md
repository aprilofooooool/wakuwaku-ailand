# backlog-done（解決済みの索引）

- D-1 オセロっちを core のキャラ・セリフ・保存・reaction に乗せ替える — 2026-11-09 `done/D-1_othello-core/`（ブランチ `feat/othello-core-migration`）
- U-1 オセロっちの操作を Pointer Events・64px・touch-action: none に合わせる — 2026-11-09 `done/D-1_othello-core/`（同上。D-1 とまとめて実施）
- B-1 ブラウザでテストを開くと音テストと AI の時間切れテストが失敗する — 2026-11-10 計画フォルダなし（ブランチ `claude/fix-b1-browser-tests-d29a63`。音テストは AudioContext を一時的に隠して実行、時間切れテストは deadline を 1ms 過去にした）
- B-2 キャラたたき（whack）を作る — 2026-11-11 `done/B-2_whack/`（ブランチ `claude/whack-design-82429d`。残作業：cheer・love の画像を追加したら emotion-map の行を書き換える）
- B-3 3ゲームのキャラの反応バリエーションを増やす（表情の候補・待ちくたびれ sleep・れんぞく・オセロっちの印） — 2026-11-12 `done/B-3_reaction-variety/`（ブランチ `claude/unruffled-torvalds-a553e5`。残作業なし。あとまわし：オセロっちの起床時にねむりの吹き出しを消さない・パス表示中に数え始めることがある）
