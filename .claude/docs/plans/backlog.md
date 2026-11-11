# backlog（未解決タスクの唯一の正）

## B-2 キャラたたき（whack）を作る
- 現象：3本目のゲーム「キャラたたき」が入口で「じゅんびちゅう」のまま。
- 原因：未実装。core に複数指の押下通知（onPress）・固定間隔ループ（loop.js）・`smug` 表情がない。
- 方針：設計書どおり core を3点拡張し、`games/whack/` を drop4 の形で作る。計画は `active/B-2_whack/2026-11-11-plan.md`。
- 関連：`.claude/docs/specs/2026-11-11-whack-design.md`、要件書 §5。
