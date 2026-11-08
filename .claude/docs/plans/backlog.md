# backlog（未解決タスクの唯一の正）

## D-1 オセロっちを core のキャラ・セリフ・保存・reaction に乗せ替える
- 現象：オセロっちは自前の characters（セリフ入り）・storage・line-picker・batch 処理を持つ。
- 原因：Phase 1 は「名前空間等の置き換え以外のロジック変更をしない」方針（要件4、設計書 §4.3）。
- 方針：Phase 2 以降。キャラ追加時にオセロ側へも1エントリ要る状態を解消する。replay で一致を確認しながら進める。
- 関連：`.claude/docs/specs/2026-11-08-ailand-phase1-design.md` §4.3

## U-1 オセロっちの操作を Pointer Events・64px・touch-action: none に合わせる
- 現象：オセロっちは click・48px・`touch-action: manipulation`。
- 原因：要件 D7 で Phase 1 では変えないと決めた。
- 方針：共通の操作規約に合わせる作り直し。娘の使い勝手で困りごとが出たら優先度を上げる。
- 関連：要件 1.2、D7
