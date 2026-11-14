# backlog-done（解決済みの索引）

- D-1 オセロっちを core のキャラ・セリフ・保存・reaction に乗せ替える — 2026-11-09 `done/D-1_othello-core/`（ブランチ `feat/othello-core-migration`）
- U-1 オセロっちの操作を Pointer Events・64px・touch-action: none に合わせる — 2026-11-09 `done/D-1_othello-core/`（同上。D-1 とまとめて実施）
- B-1 ブラウザでテストを開くと音テストと AI の時間切れテストが失敗する — 2026-11-10 計画フォルダなし（ブランチ `claude/fix-b1-browser-tests-d29a63`。音テストは AudioContext を一時的に隠して実行、時間切れテストは deadline を 1ms 過去にした）
- B-2 キャラたたき（whack）を作る — 2026-11-11 `done/B-2_whack/`（ブランチ `claude/whack-design-82429d`。残作業：cheer・love の画像を追加したら emotion-map の行を書き換える）
- B-3 3ゲームのキャラの反応バリエーションを増やす（表情の候補・待ちくたびれ sleep・れんぞく・オセロっちの印） — 2026-11-12 `done/B-3_reaction-variety/`（ブランチ `claude/unruffled-torvalds-a553e5`。残作業なし。あとまわし：オセロっちの起床時にねむりの吹き出しを消さない・パス表示中に数え始めることがある）
- B-4 4曲の BGM の曲調を作り分ける — 2026-11-13 `done/B-4_bgm-variety/`（ブランチ `claude/stoic-neumann-f697fd`。残作業なし。あとまわし：低音の音の長さが試作より長め（92% と 85%）・スイングで遅らせた音の長さを縮めていない）
- B-5 おちブロック（blocks）を作る（時間の制限・ほしブロック・目標 15／30／50 を含む） — 2026-11-14 `done/B-5_blocks/`（ブランチ `feat/blocks`。残作業なし。あとまわし：ほしのあとに4列連続で消えると盤が2回光ることがある・見えない上の段の自分の顔が盤の外から飛んでくる）
- B-6 おちブロックにきろくチャレンジ（3分で集めた数の記録）・かおあつめのタイム記録を足し、ボタンを ← ↓ いっき ↻ → に並べる — 2026-11-14 `done/B-6_blocks-challenge/`（ブランチ `feat/blocks-challenge`。残作業なし。あとまわし：ブラウザテストの `core/IdleTimer` が初回だけ落ちることがある（別セッションの提案あり））
