# BoxingSim Memory Index

このプロジェクトに関する記憶ノートの索引。`docs/vision/` には長期的に動かない理念、`docs/memory/`（このフォルダ）には個別・進行中の記憶を置く。

## 理念・大目的（docs/vision/）

- [User: AIで面白いものを量産する統一構想](../vision/user-creative-ai-vision.md) — FSMで人間の面白さを仕組み化することが基礎。複数プロジェクトを貫く方法論
- [Project: ボクシングシムの本質はFSM方法論の検証台](../vision/project-fsm-as-foundation.md) — 機能網羅ではなく FSM のリアリティ再現度が評価軸
- [Feedback: FSMブラッシュアップを最優先で考える](../vision/feedback-prioritize-fsm-quality.md) — 機能提案は「面白さの仕組み化に効くか」で評価し、点ではなく線（試合の流れ）を語る
- [Feedback: 機械的仕組みを先に積む。面白さは結果として立ち上がる](../vision/feedback-mechanics-first-fun-emerges.md) — 「面白さ」を目標にして逆算しない。実物のどの仕組みを再現できていないかを問い、機械的に定義する

## 進行中の記憶（このフォルダ）

- [Feedback: フェイントは誘発対象の待ち状態とセットで設計](feedback-feint-needs-bait-target.md) — 能動的な「カウンター待ち/読み構え」が FSM に無いうちはフェイント実装は損な選択肢にしかならない
- [Project: 頭/腹2択 → バックステップ → コーナー回数制限の輪](project-head-body-stepback-corner-loop.md) — 頭/腹打ち分け後はバックステップ多発→コーナー機構+回数制限で完成する設計線

## メモ

- メモリの正本はこのフォルダ。CLI Claude Code が自動参照する `~/.claude/projects/C--Users-hoeho-Documents-Claude-BoxingSim/memory/` にも同じファイルが存在するが、編集はこちらを先に行い、必要なら CLI 側へ反映する。
- 上位の Desktop Claude Code メモリ（`~/.claude/projects/C--Users-hoeho/memory/`）はこのプロジェクト固有ではない・横断的な記憶のみを置く（user-claude-code-beginner など）。
