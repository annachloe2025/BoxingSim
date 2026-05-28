# タスク一覧

## フェーズ1（最小システム）✅ 完了
- [x] CLAUDE.md / LOG.md / TASKS.md の作成
- [x] 最小フレームエンジンの実装（再生・一時停止・コマ送り・コマ戻し・リセット）
- [x] Player と 敵 の2体、1次元座標と状態（待機/始動/発生/硬直）を常時表示
- [x] 技データ（始動/発生/硬直/リーチ）を定義・編集できる
- [x] 各キャラに行動列を入力して再生できる
- [x] 発生中の接触判定（間合い内か）と接触イベントのログ表示

## 既存の拡張（完了分）
- [x] 被弾の影響（のけぞり / ガード硬直）
- [x] カウンター判定（相手の始動中＝1.5倍 / 発生中＝相打ち / 硬直＝パニッシュ）
- [x] HP・ダメージ・ガードによる防御・KO（勝敗）
- [x] 行動のAI化（確率型ユーティリティ・性格4軸）
- [x] 連続移動＋キャンセル（実ボクサーの感覚に寄せた移動モデル）
- [x] 状態グループのカード背景着色（待機/移動・攻撃・被弾・ガード）

## 駆け引きを生む3段階（次のロードマップ・2026-05-26 決定）
動機: 現状は機能はあるが「シンプルすぎて駆け引きが起きない」。実物に存在する仕組みを順に積み、駆け引きが**結果として**立ち上がる状態を目指す。順番は依存関係でこの順。
- [x] **段階1: スタミナシステム** ✅ — パンチ・移動を有限資源化。「打てる/打てない」「動ける/動けない」の選択が発生
  - [x] Step A: 値の導入・消費・回復・表示・観測スキーマ拡張（効果未実装）
  - [x] Step B: 閾値効果（damage 係数 / startup 延長 / 移動 speed 係数）
  - [x] Step C: AI 側に staminaAware 軸を追加し scoreActions に倍率適用
- [x] **段階2: 頭部/腹部の打ち分け** ✅ — 攻め2択・守り2択の照合機構。読み合いは段階3 と組んだとき初めて成立する想定
  - スコープ縮小: フェイントは「誘発対象の待ち状態」設計と一緒に後段に分離（→ 将来候補へ）
  - [x] Step A: MOVES 拡張(10→15)・target 属性・判定ロジック刷新（AI は head 固定 / Identity Check 完全一致）
  - [x] Step B: 攻撃 target 倍率（相手ガードの逆を狙う）— 時間切れ激減・KO率上昇
  - [x] Step C: 守備 target 倍率（相手攻撃に合わせる）— 完全情報＋無遅延で守備が常勝、時間切れ 50/50。段階3 の動機が裏付け
- [x] **段階3: 知覚反応（反応遅延 / 観測の不完全さ / 注意の偏り）** ✅ — 多段知覚（presenceLag / detailLag）+ 強ストレート + フェイント上下まで導入。詳細: `reports/2026-05-26-phase3-complete.html`

## 将来候補
- [x] フェイント上/下（B4）— 段階3 で startup=4/active=0/recovery=0 として導入済み
- [ ] コーナー機構（D1）+ バックステップ回数制限 — 段階3 後に頭/腹2択回避が顕在化したら（メモ: project-head-body-stepback-corner-loop）
- [x] **段階3 (α): 守備 AI 構造改善** ✅（プラン: `~/.claude/plans/ai-gleaming-hollerith.md`）— `reports/2026-05-26-perception-lag.html` で抽出された3問題の解消
  - [x] Step A: 配管 + verify.js 拡張 + Identity Check ✅（2026-05-27 完了）
  - [x] Step B: guardScore 式の構造修正 + guardCommitment=0.5 有効化 ✅（2026-05-27 完了。だが guardCommitment は verify.js ELEM stub バグで実は無効。Step B 効果 = 式変更のみ）
  - [x] Step C: guardSwapStartup=3F 有効化 + 既存バグ修正 ✅（2026-05-27 完了。真の Step B+C 合成効果が初観測。両守備型ガ切替 -37〜-49%、振動→機能の質的転換、5劇保持、lag=2/4 スイートスポット維持）
  - 残課題（別タスクへ）:
    - [ ] (B) lag 既定値再決定: verifier 推奨は第1候補 (p=2, d=4)、第2候補 (p=3, d=5)、補助 (p=1, d=2)
    - [ ] guardCommitment 感度分析（0.5/0.7/0.9）— 両守備型ガ切替がまだ高め
    - [ ] R1 (lag=0/0 時間切れ 90%) 対応: lag=0 運用の見直しか、別の構造修正か
- [ ] **段階4: 敵行動予測モデル**（プラン: `~/.claude/plans/ai-gleaming-hollerith.md`）— 実物ボクサーのスカウト + 試合中読み更新を機械化
  - [x] Step A: 予測モデル配管（PERS + makeChar + updatePrediction + renderObs）+ Identity Check ✅（2026-05-27 完了。MD5 完全一致、予測精度 state 72%/attackTarget 58%）
  - [x] Step B: scoreActions の soft 化 + 観測 > 予測原則 ✅（2026-05-27 完了。MT 既定値は verifier 観測で 0.5→0.3 に調整。lag=2/4 スイートスポット維持、block/clean (lag=3/5) 0.22→0.32 改善、5劇再現）
  - [ ] Step C: modelPrior 設定 UI + modelDecay 調整 + 性格との交互作用観察
  - Step C 前検討:
    - [x] 観測空白活用率の verify.js 指標化 ✅（2026-05-27 完了。MT 単調増加で予測効果の直接証拠、ただし絶対値はプラン想定より低い 〜16%）
    - [ ] guardCommitment 感度分析 (0.5/0.7/0.9)（α 段階からの保留、Step C 着手前推奨）
    - [ ] 低 lag (p1/d2) 時間切れ悪化の構造解明（observation > prediction 原則の境界判断）
    - [ ] predictedAtkT の attacker 側効果検証（攻撃 kind 分布が MT で不変問題）

- [ ] **段階5: ラウンドシステム + 判定システム**（プラン: `~/.claude/plans/ai-gleaming-hollerith.md`）— ガードへの代償を「試合構造として」機械化（判定で負けると攻撃必須になる）
  - [x] Step A: ラウンドシステム配管 + Identity Check ✅（2026-05-27 完了。MD5 `81eb68488e55b9902d1010da41d7dd71` 一致）
  - [x] Step B: ラウンド境界 + インターバル + UI ✅（2026-05-27 完了。時間切れ激減 29→2、スイートスポット維持、Identity Fallback PASS、MAX_FRAME 動的計算化 1070F）
  - [x] Step C: 採点 + 判定決着 + 最終結果表示 ✅（2026-05-27 完了。配管完成・Identity Fallback PASS・時間切れ全シナリオ 0/50。ただし「守備一辺倒で判定負け」設計目標は部分達成: 判定到達率ほぼ 0%、chip 係数 0.3 が弱い）
  - 段階5 残課題（別タスクへ）:
    - [ ] 採点係数調整（chip 0.3→0.5-1.0 / 10-8 閾値変更）— 設計目標達成への調整
    - [ ] HP 残存率の採点算入 — 判定発火条件拡張
    - [ ] 10-9/10-8/10-10 内訳の verify.js 出力 — R5 詳細調査

- [ ] **次の段階候補**:
  - [ ] ガード崩し機構 C (ガードクラッシュ攻撃) — 段階5 が「足りない」を機械的に裏付けた次の自然な候補
  - [ ] 段階4 Step C: modelPrior UI 等（保留中）
  - [ ] (B) lag 既定値再決定（α 段階からの繰越）— MT=0.3 でも block/clean=0.26 と低い

- [ ] **将来候補（段階5 完了後）**
  - [ ] ガードクラッシュ (C) — 攻撃側にガード崩し効果
  - [ ] ダウン / 立ち上がり (A3) — 判定システムと連動
  - [ ] スタミナシステム見直し → 連動して B (ガード継続ペナルティ)
  - [ ] 段階4 Step C: modelPrior UI 等（保留中、再開判断必要）
  - [ ] (B) lag 既定値再決定（α 段階からの繰越）
  - [ ] (B) ルート: lag 既定値の再決定（Step C 後の別タスク）
- [ ] ダウン / 立ち上がり / TKO（A3, A4）
- [ ] 距離の2次元化（D2）
- [ ] ラウンド制 / 判定（E1, E2）
- [ ] 技量パラメータ・スタイル類型（F1, F2）
- [ ] 性格の状況依存（F3）
- [ ] ラウンド戦略・相手の癖の学習（G1, G2）
- [ ] グラフィカル表示
- [ ] その他（→ `fsm_gap_inventory.html` に全項目を棚卸し済）

## メモ
- 設計の根幹は `CLAUDE.md` を参照。
- 方法論メモは `docs/memory/MEMORY.md`（理念は `docs/vision/`、特に `feedback-mechanics-first-fun-emerges.md` = 機械的仕組みを先に積み、面白さは結果として立ち上がる）。
- 仕様変更や決定事項は `LOG.md` に日付で追記する。
- 実物のボクシングとの差分一覧は `docs/design/fsm_gap_inventory.html` を参照。
- 2026-05-27 にフォルダ構成を整理。詳細は `archive/setup_proposal_2026-05-27.html` と LOG.md。サブエージェント体制（designer / implementer / reporter / verifier）を `.claude/agents/` に導入。
- ダッシュボードは `README.html`（HTML で開く）。
