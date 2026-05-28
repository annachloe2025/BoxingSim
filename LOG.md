# 開発ログ

## 2026-05-24
- プロジェクト開始。フォルダ `C:\Users\hoeho\Documents\Claude\BoxingSim` に接続。
- 方針について相談を実施。決定事項は以下。
  - フレーム単位の戦闘エンジン型シミュレーターとする（格ゲーのフレームデータをボクシングに応用）。
  - 距離は1次元から開始。将来的に2次元へ。
  - 行動の判断は当面は手動入力。将来的にAI化。
  - 被弾の影響（ダメージ・勝敗等）は当面扱わない。フレームの噛み合いの観察を優先。
  - 技術はブラウザ（HTML/JS）、表示は文字ベース。
- CLAUDE.md / LOG.md / TASKS.md を作成。
- フェーズ1として、フレームを再生ボタンで進められる最小システム（index.html）を作成。
  Player と敵の2体、各キャラの状態を常時表示、技データと行動列を編集可能、接触をログ表示。
- UI調整: プレビューに収まるよう全体をコンパクト化（余白・文字・ログ高さを縮小）。
- UI調整: キャラカードに状態と同じ大きさで「現在の行動（前進/ジャブ等）」を併記。
- UI追加: 間合いゲージ上に攻撃のリーチを帯で可視化（発生中=濃, 始動中=淡, 自分=緑/敵=赤）。凡例を追加。

## 2026-05-25
- 路線をステートマシン（FSM）の設計に変更。1人のボクサーのFSMを「カチッと」定義していく方針。
- `boxer_fsm.mermaid`（初版たたき台）を作成。状態11個＋遷移を定義。
- `boxer_fsm.html` を作成し、mermaidをブラウザ描画。
  - 文字色がmermaid内部スタイルに負けて表示されない問題を、描画後にJSでインライン!important指定する方式で解決。
  - 拡大・縮小・移動（ホイール/ドラッグ/ボタン）を実装。
- 視認性向上のため、同じFSMを3通りで併記する形に拡張。
  - (1) mermaid図＝俯瞰、(2) 遷移マトリクス表＝状態×きっかけの一覧、(3) 状態カード＝1状態ずつの詳細定義。
  - 3者の遷移定義（全23本）が一致することを確認済み。
- 未決定（要相談）として記録: ※1 移動キャンセルの可否 / ※2 硬直キャンセルの可否 / ※3 ガードの型（押し続け/時間）と被弾系の保持フレーム。
- 状態・遷移の分類を整理した `boxer_states_taxonomy.html` を作成（純HTML/CSS）。
  - 遷移のきっかけを4分類（①自発 ②自動=時間 ③外発=相手 ④強制=審判/ルール）に整理。Claudeの意見4点を併記。
  - 「被攻撃」は1イベント＋文脈（受けた瞬間の自分の状態）で結果が分岐、という考え方を提示。
- 4グループ構成のmermaid図 `boxer_fsm_groups.html` を作成（①ベース/②自発行動/③被弾リアクション/④強制）。
- AI対戦に向けた設計開始。AIに渡す「観測データ（observation）」のスキーマを合意。
  - self（完全把握）/ opponent（★後で曖昧化）/ relative（間合い・接近・届く技・射程内）の3区分。
  - 相手の phaseRemaining と action は本来人間には見えない情報 → 後で曖昧化する対象として★印。
  - 観測は毎フレーム両者ぶん生成。AIの出力は行動1つ、行動不能中の入力は無視する想定。
  - index.html に observation 生成（buildObs）と画面表示を実装。完全データ版。Nodeで値の整合を検証済み。
- 単純ルールAIを実装（①相手攻撃中で射程内→ガード ②ジャブ届く→ジャブ ③遠い→前進）。AI対AIで自動再生可能に。
  - 1フレーム内の評価順による不公平（後評価側が即反応）を修正し、両者が同じ局面を見て同時決定する方式に。
  - 完全情報＋ラグなしだと相打ちジャブの反復ループに収束することを確認（曖昧さ導入の動機）。
- 移動モデルを「連続移動＋キャンセル」に刷新（実ボクサーの感覚に寄せる）。
  - 普通移動(前/後, 速0.4, 開始1Fのみキャンセル不可) / ガード移動(前/後, 速0.2, 常時ガード) / ステップイン・ステップバック(速0.6, ガード不可, 停止時1F硬直)。
  - キャンセルは「状態ごとの受付入力」方式: アイドル=全受付 / 移動中=ジャブ・ストレート・ガード受付 / 攻撃中=受付なし。将来のコンボ設計にも流用可能。
  - 連続移動はAIが毎フレーム意図を返すことで実現。間合いに入った瞬間にジャブへキャンセルされ、縁付近(一歩の行き過ぎ)で止まることを確認。
  - 観測の canAct を「キャンセル可能か」に更新。stateLabel/charCard/技編集テーブルも新仕様へ。
  - 注: FSM図・マトリクス・カード(boxer_fsm*.html)はまだ旧移動のまま。次回この新移動に合わせて更新予定。
- ユーティリティAIを実装（固定if文ルールから置き換え）。
  - 性格4軸: 攻撃性 / 防御性 / 好む間合い / 我慢強さ。UIスライダーで Player・敵 ごとに設定。
  - 各行動を観測＋性格で点数化し、点数^2 に比例した確率で選択（確率型）。SCORE_POWで貪欲さを調整可。
  - 毎フレームのジッタ防止に再判断間隔(DECIDE_EVERY=3)。行動可能かつ間隔経過時のみ再サンプル。
  - 各行動の点数・選択確率を画面表示（選択を▶表示）。1位以外も選ぶことを確認。
  - 非対称な性格(攻撃型P/守備型E)で鏡写しループが崩れ、踏み込み・間合い取り直し・ガード・差し返しが創発することをNodeで確認。
  - 将来: カウンター型/持久型/パワー型/ヒットアンドアウェイ型などの戦術タイプは、この4軸のプリセットとして実装予定。
- HP・ダメージ・勝敗を導入（最適化のゴールを測れるようにするため。当初の「被弾は扱わない」方針を初めて拡張）。
  - HP100。ジャブ-5／ストレート-12。1パンチ=1回だけダメージ（atkLandedフラグ）。
  - ガード（ガード／ガード移動中）に受けたらダメージ0（防御成功）。HP0でKO→試合終了・勝者表示。HPバー表示。
  - 観測にもHPを追加。Nodeで多重ヒットなし・正しい減算・KO終了を検証（攻撃型P勝ち、E HP0、約470F）。
  - 未実装（次の候補）: のけぞり、カウンター割増。
- ガード統合＆のけぞり/ガード硬直を実装。
  - 独立「ガード」を廃止し、その場ガード（速度0・常時防御・始動0・解除自由）に統合。ガード前進/後退と同じ性質に。
  - 被弾＝のけぞり（相手の動作を中断＋ロック）、ガード＝ガード硬直。硬直値は「技の戻り基準」で設定。
    - のけぞり＝戻り+2（ジャブ8/ストレート14）、ガード硬直＝戻り（ジャブ6/ストレート12）。技編集表から調整可。
    - 有利フレームをジャブ始動(3)未満の最大+2に抑え、ジャブの確定ループを防止（検証で連鎖最大1を確認）。
  - 相打ち維持のため、両者の命中を先に検出→効果適用の2パス方式。検出時に攻撃キーを保持（相打ちでの取りこぼしバグを修正）。
  - のけぞり中は punish 対象としてAIが差し込みを評価。Nodeで流れのうねり・KO・ループ無しを確認。
  - 未実装（次の候補）: カウンター割増、ダウン/立ち上がり、削り(チップ)ダメージ、スタミナ。
- カウンター導入（ダメージのみ・確定コンボにはしない方針）。
  - 被弾時の相手状態で分類: 始動=カウンター(ダメージ1.5倍・クリーン) / 発生=相打ち(両者等倍) / 硬直=パニッシュ(等倍) / その他=通常。
  - 方針: 通常の攻防では連続確定攻撃を作らない（有利フレームは全種+2どまり）。カウンターも威力だけで、のけぞりは通常と同じ。
    連続技は将来の「グロッキー状態（何でも入る窓）」専用とする（リアルボクシング準拠）。
  - ジャブ始動 3→4（カウンターを取れる窓を広げる＆+2でも防御が間に合うようにする）。
  - Nodeで直接検証: 始動つぶし=8(5×1.5)・待機=5・硬直=5・相打ち=両5、連鎖最大1（コンボ無し）を確認。

## 2026-05-26
- キャラカード（HP/状態表示）の背景を状態グループで着色し、攻防が一目で分かるように。
  - 緑=待機・移動 / 青=攻撃(始動・発生・硬直) / 赤=被弾(のけぞり) / シアン=ガード。
  - 実装: CSS `.char.grp-*`（背景＋inset枠）、`stateGroup(ch)` で分類、render()で毎フレーム `grp-*` クラス付与。P/E識別の左縁（緑/赤）は維持。
  - 背景色を分けた動機: 相打ち時に「発生(赤系)→のけぞり(赤系)」がほぼ同色で状態変化が見えにくかったため。攻撃=青に分けて解消。
  - 確認事項: 被弾時の状態遷移は元々正しい。接触処理で被弾側 moveKey=null（攻撃中でも中断）＋stun/stunType="hit" → stateLabel が「のけぞり」を返す。
  - ついでにサブ見出しの古い記述（「のけぞり・カウンターは未実装」）を実装済みに修正。
- ガードのカード背景色をシアン→黄色(#ffce4d系)に変更（視認性向上の要望）。状態テキスト色は据え置き。
  - メモ: カード表示「ガード ガード」=構え中、「待機 ガード」=ガード硬直（被弾でmoveKey=nullのため行動側が待機表示）。
    行動ラベルをガード硬直/のけぞりと出す改善は提案済み・未実施（要承認）。
- 上記の行動ラベル改善を実施。actionLabel に stun 判定を追加: stunType="hit"→「のけぞり」/ "block"→「ガード硬直」。
  これで「待機 ガード」（紛らわしい表示）が「ガード硬直 ガード」に、被弾中は「のけぞり のけぞり」になる。
- プロジェクトの本質を再確認: ボクシングシム本体だけでなく、**AIで面白い作品を量産する方法論**
  （人間の面白さを FSM で仕組み化することが基礎）の検証台でもあるという前提を `docs/` 配下に保存。
  関連メモ: `user-creative-ai-vision.md` / `project-fsm-as-foundation.md` /
  `feedback-prioritize-fsm-quality.md` / `feedback-mechanics-first-fun-emerges.md`。
  特に「面白さを目標にして逆算するのではなく、機械的仕組みを先に積み、面白さは結果として立ち上がる
  ように作る」が方法論の核。
- `verify.js`（一時ハーネス、index.html の `<script>` を vm で評価して回す）で現状の挙動を観察:
  - 攻撃型P × 守備型E を 50戦回すと P:E:時間切れ=19:3:28、完全対称で 8:10:32。
  - 当初の動機だった「相打ちジャブのループ」は確率型AIの揺らぎで自然に脱出しており、代わりに
    「opponent.action / phaseRemaining が完全に見えるため AI のガード反応が超人的 → 攻めが通らず
    時間切れが多発」が表面化。
- 実物のボクシングとの差分を `fsm_gap_inventory.html` に棚卸し（22項目／未17・部分5・済0）。
  カテゴリ: 身体・物理 / 行動・技 / 知覚・反応 / 位置・空間 / ルール・試合構造 / 個性・技量 /
  戦略・読み。重要度ランクは付けず、選ぶ軸を「実物として無視できない度 / 機械的定義可能性 /
  既存 FSM との整合」と明示。
- 次のロードマップを決定: **①スタミナ → ②フェイント+頭/腹打ち分け → ③知覚反応(オンオフ可)**。
  「シンプルすぎて駆け引きが起きない」状態を、リソース有限 → 攻守の2択発生 → 読みが必要、の順で
  機械的に作る。③が方法論上の**コア**で、スタミナ・展開連動で知覚能力を動的に変化させる土台。
- スタミナ仕様 v2 を `stamina_spec.html` に確定（スライダー付き）。
  消費: 攻撃と移動のみ（ジャブ-6・ストレート-15・前/後退-0.2/F・ステップ系-1.0/F・ガード移動-0.3/F）。
  回復: 待機 +1.0/F のみ。閾値効果は連続関数で軽め(damage係数 0.8-1.0 / startup ×1.0-1.2 /
  移動speed ×0.85-1.0)。AI は性格5軸目 staminaAware を追加し攻撃 score に倍率適用。
  実装は Step A(値だけ) → B(効果) → C(AI) の3段階分割。
- **スタミナ Step A 実装完了**: index.html に staminaCost(全MOVES) / makeCharの stamina=100 /
  startAction で攻撃消費 / stepSim 内に「移動per-F消費＋待機+1.0/F回復」のステップ追加 /
  charCardにスタミナバー(青系#5aafff) / 観測スキーマに self.stamina(完全)・opponent.stamina(★) /
  技テーブルに staminaCost 列。**効果は未実装**(damage/startup/speed は素のまま)。
  verify.js で Identity Check: seed=1,2,3 の結果が Step A 前と完全一致(535F/728F/800F)。
  観察: AI がスタミナを意識せず使い切るため、平均スタミナ P=21・E=29、試合の約30〜47%が
  スタ0で経過。これは Step C 未実装の必然(想定通り)。Step B 投入で序盤から劣化開始する見込み。
- **スタミナ Step B 実装完了**: index.html に `effectivePhaseLen(ch)` ヘルパー追加 →
  advancePhase / phaseRemain / charCard で startup の参照を一貫して実効値に切替。
  stepSim の移動処理に `staK_spd = 0.85 + 0.15*s/100` 適用、ダメージ適用箇所に
  `staK_dmg = 0.8 + 0.2*s/100` 適用。recovery / active は素のまま(影響範囲を絞る)。
  verify.js 50戦比較:
    - 非対称: 時間切れ 28→**45**、P勝 19→4。スタ0滞在 P=17712→18060F、E=11023→11678F。
    - 対称: 時間切れ 31→**42**、P勝 9→2 / E勝 10→6、KO中央値 679→771F。
  観察: 機構は正しく動作。だが AI が「ガス欠で殴り合う」非実物的挙動を続けるため、
  弱い攻撃 × 遅い攻撃の応酬で守備側が有利に → 時間切れが激増。「結果として何が立ち上がった
  か」の典型例。Step C で AI のスタミナ意識を入れることで序盤温存 → 終盤に決め、のメリハリ
  が出ることを期待する。
- **スタミナ Step C 実装完了 → 段階1 完了**。PERS に 5軸目 staminaAware を追加(既定 0.5)、
  scoreActions の攻撃点数に atkK = max(0, 1 - sa*(1 - s/100)) を掛ける。UIに性格スライダー
  「スタミナ意識 (0-100)」を追加。
  verify.js 50戦比較(非対称、sa違い):
    - sa=0.0 (Step B 相当): P勝4/時間切れ45、スタ0F合計 P=18060/E=11678、ジャブ1023/712
    - sa=0.5 (既定):        P勝6/時間切れ44、スタ0F合計 P=12490/E=3652、ジャブ999/554
    - sa=1.0 (最大):        P勝2/時間切れ48、スタ0F合計 P=51/E=0、    ジャブ914/465
  観察:
    - staminaAware を上げると AI は明らかにスタミナを温存する(スタ0F合計が急減)
    - sa=0.5 で一番バランス良い(P勝率最高、ガス欠半減、攻撃数も適度に維持)
    - sa=1.0 は温存しすぎて攻め控え → 試合が静かになる
    - 段階1 単独では「決定打が打てず時間切れ多発」は残る(時間切れ44〜48/50)
    - これは「攻撃の質的差別が無い(評価軸がスタミナのみ)」の必然 → 段階2(フェイント+頭/腹
      打ち分け)で「攻撃の選択肢」を増やすことで「効くタイミングを選ぶ」AIに進化する想定。
  段階1のゴール「リソース有限化」「機械的にスタミナ管理ができる AI」は達成済み。
- 段階2 の仕様相談 → スコープを **頭/腹打ち分けのみ** に縮小決定（フェイントは後段に分離）。
  - 理由: フェイントは「相手の能動的な待ち状態（カウンター待ち・読み構え）を誤発火させる」道具。
    今の FSM に「待ち状態」が無いため、先に作っても損な選択肢にしかならない（記憶: feedback-feint-needs-bait-target）。
  - 設計線として「頭/腹2択 → バックステップ回避 → コーナー追い詰め → 回数制限」が次の波として記録
    （記憶: project-head-body-stepback-corner-loop）。
- 仕様書 `head_body_spec.html` を確定。攻撃4種・ガード6種・▲(head)/▼(body) symbol で完全対称。
  AI は新性格軸なし、攻撃側「相手ガード逆を狙う」(×1.5/×0.3)、守備側「相手攻撃に合わせる」(×2.0/×0.5)。
  3 ステップ分割（A: データと判定 → B: 攻撃AI → C: 守備AI）で実装。
- **段階2 Step A 実装完了**: MOVES を 10→15 に拡張、target 属性付与、▲/▼ symbol で命名。
  接触判定を `victimState==="ガード"` → `getGuardTarget(opp)===m.target` に置換。
  ガード硬直中の target は `stunTarget` で保持。観測に self/opponent の guardTarget/attackTarget を追加（opponent 側は ★）。
  scoreActions は head 行動の score を完全保存、body 行動は score=0 で絶対選ばれない構造に。
  verify.js で **Identity Check 完全一致** を確認（sa=0/0.5/1.0 すべて段階1完了時点の P勝=4/6/2・時間切れ=45/44/48・
  ジャブ数 1023/999/914・スタ0F合計 18060/12490/51 が完全一致）。
- **段階2 Step B 実装完了**: 攻撃 target 倍率を導入（oppGT=null→等倍、ガード方向→×0.3、逆→×1.5）。
  verify.js 非対称50戦比較:
  - sa=0:   P勝0→**27** / 時間切れ45→**2** / KO中央値=588 / clean=879 block=430 slip=415
  - sa=0.5: P勝6→**40** / 時間切れ44→**6** / KO中央値=639 / clean=769 block=504 slip=510
  - sa=1.0: P勝2→**33** / 時間切れ48→**16** / KO中央値=690 / clean=691 block=481 slip=520
  観察:
  - body率 ~50%（守備が head 固定でも、AI が攻撃を考えるとき相手が非ガード状態のことが多く oppGT=null → 等倍 50/50）
  - slip(部位ミス) が block と同程度 → 守備の半分がすり抜けた = head 固定の脆さが数値化
  - 攻撃が通るようになり試合時間が激減（前は時間切れ多発、今は決着が普通に出る）
- **段階2 Step C 実装完了 → 段階2 終了**。守備 target 倍率を追加（oppAtkT=null→▲×1.2/▼×1.0、
  head→▲×2.0/▼×0.5、body→▲×0.5/▼×2.0）。性格軸は既存5軸のまま追加なし。
  verify.js 非対称50戦比較:
  - sa=0:   P勝0  / E勝0  / **時間切れ=50** / clean=447 block=**1881** slip=**106**
  - sa=0.5: P勝0  / E勝0  / **時間切れ=50** / clean=334 block=1874 slip=108
  - sa=1.0: P勝0  / E勝0  / **時間切れ=50** / clean=269 block=1491 slip=92
  観察:
  - **150戦すべて時間切れ**。守備が常に追従してダメージがほぼ通らない
  - block:slip = ~95:5 → 守備の追従精度95%。残り5%は decideEvery=3F の判定ラグ
  - body率は両者とも 49〜52% → お互いに「逆を狙う/合わせる」が釣り合い、最終的に 50/50 ランダムに見える
  - HP は両者高残（70〜90%）で時間切れ。スタ0F は依然多いがそれでも決着せず
  - これは予想通り「完全公開＋無遅延 → 守備が常に勝つ → 攻撃通らず」の状態
  - **段階3（反応遅延 / 観測曖昧化）の動機が機械的に裏付けられた**: defender が瞬時に追従できるから時間切れになる
  - 段階2 完成後の次の線（記憶 project-head-body-stepback-corner-loop の予想）はまだ表面化していない
    → バックステップで両択回避するより、その場ガードで両択防御できてしまうため。コーナー機構を入れる前に、
    段階3（反応遅延）でバランスを変える方が筋。
- **段階3 中間: 知覚遅延（perceptionLag）の実装と観測**（詳細レポート: `reports/2026-05-26-perception-lag.html`）。
  - 観測スキーマの ★ フィールド（opponent.action / phaseRemaining / guardTarget / attackTarget）を
    遅延バッファに通し、AI が見る相手情報を lag フレーム前のものにする。
  - 観察: lag を上げると守備が threatened フラグの更新に間に合わず、KO が突然増える非線形挙動。
    body 率は 50% のまま（守備が打ち分けを認識する前に追従できないため）。
  - 構造的問題が3つ表面化:
    ① 守備 AI が threatened フラグに依存しすぎ
    ② ガード切替コスト 0F の前提が崩れる
    ③ 一方的試合になりやすい（先に殴られた側が崩れる）
  - 次の手の候補(A)守備 AI 構造修正 / (B)既定 lag を下げる / (C)フィールド別ラグ細分化 を整理。
- **段階3 完成版: 多段知覚 + 強ストレート + フェイント**（詳細レポート: `reports/2026-05-26-phase3-complete.html`）。
  - ① 多段知覚: 単一 lag を `presenceLag`（攻撃が来てる/来てない）と `detailLag`（部位・技種）の2層に分離。
  - ② 強ストレート: startup=10, chipRatio=0.3 を追加。読まれやすいが当たれば崩せる選択肢。
  - ③ フェイント上/下: startup=4, active=0, recovery=0。誘発対象として機能（→ フェイント実装に着手）。
  - ④ 射程内ガード選好（inRange）修正で守備の張り付き過ぎを是正。
  - 観察: 「攻撃 startup × detailLag」のマトリクスで、ジャブの賭け／ストレートは見てガード／強ストレート vs ジャブ
    割り込み／フェイント誘発／チップ崩し、の5つの「劇」が立ち上がることを確認。
  - 注: TASKS.md ではまだ段階3 をオープン扱いにしていたが、本記載で実装は完了とみなす（タスク同期は別途）。

## 2026-05-27
- プロジェクトのフォルダ構成を整理（詳細は `archive/setup_proposal_2026-05-27.html`）。
  - ルート直下のフラット dump を解消: `src/`（実装）/ `tools/`（検証）/ `docs/{vision,design,memory}/`
    / `reports/`（人間向けレポート）/ `archive/`（過去置き場）/ `.claude/agents/`（サブエージェント定義）。
  - 既存ファイル移動: index.html→src/, verify.js→tools/, FSM・spec html → docs/design/,
    perception/phase3 レポート → reports/（`YYYY-MM-DD-*.html` で命名）, 理念 md → docs/vision/。
  - メモリ統合: CLI 側 memory にしか無かった `feedback-feint-needs-bait-target.md` と
    `project-head-body-stepback-corner-loop.md` を `docs/memory/` にコピー。`docs/memory/MEMORY.md` を
    vision/ と memory/ の両方を索引する index に書き換え。
- 進捗管理体制を3層に明文化: TASKS.md（タスク一覧）/ LOG.md（時系列正本）/ reports/*.html（節目の完成レポート、reporter エージェント担当）。README.html をダッシュボードとして新設。
- サブエージェント4体を導入: `designer`（仕様検討）/ `implementer`（実装）/ `reporter`（HTML レポート生成・LOG/README 更新）/ `verifier`（verify.js 実行と所見）。定義は `.claude/agents/*.md`。
- 過去進捗の HTML レポート化（6本）。reports/2026-05-24-phase1-minimum-system / 2026-05-25-{fsm-design, observation-ai-movement, combat-core} / 2026-05-26-{stamina-phase1, head-body-phase2}.html。reporter エージェント初仕事。
- BoxingSim 現状分析を実施。reports/2026-05-27-current-state-analysis.html に保存。次の手の候補6つを比較し、**(α) 守備 AI 構造改善**を強く推奨と判定。
- **段階3 (α) Step A 実装完了**（プラン: `~/.claude/plans/ai-gleaming-hollerith.md`）。
  - 配管: PERS 8軸目 `guardCommitment` 追加（既定 0）／MOVES ガード6種に `guardSwapStartup` 追加（既定 0）／startAction で「guard→別 target guard」検出して stopRec に入れる配管／scoreActions で guard 系 raw 値に「同 target 強化・異 target 抑制」倍率配管。すべて既定値で no-op。
  - UI: 「ガード継続選好 guardCommitment (Player/敵別)」と「ガード切替コスト guardSwapStartup (両者共通)」のスライダー追加。
  - verify.js 拡張: ガード切替頻度カウンタ／殴り合い率／lag スキャン 4段→7段（[0,1,2,3,4,5,7] × dlag）／性格パターン3ケース（両攻撃/両守備/非対称）× lag=(3,5)(5,8)。
  - **Identity Check PASS**: 既定値で seed=1,2,3 × 50戦 × lag 4段の全数値が完全一致。
  - 副次バグ修正: verify.js が 2026-05-27 フォルダ整理時に `./index.html` を見たまま壊れていた → `../src/index.html` に修正（Identity Check の前提）。
  - 新指標サンプル: 非対称 baseP/baseE (lag=0/0) で「ガード切替/試合 13.0回・殴り合い率 9.0%」、両攻撃型 (lag=3/5) で「ガード切替/試合 0.3回・殴り合い率 28.7%」。新指標が読まれているが既定 no-op であることも確認。
- **段階3 (α) Step B 実装完了**（詳細レポート: `reports/2026-05-27-defensive-ai-stepB.html`）。
  - guardScore 式の構造修正: `guardRangeBase` 0.30→0.35 / 0.05→0.10、`guardThreatBoost` 0.80→0.45（threat 依存比 3.7×→2.3×）、`guardFwdScore` inRange 分岐 0.10→0.18。`PERS.{P,E}.guardCommitment` 0→0.5 で新パラメータ有効化。
  - 機械的観察（50戦 × lag 7段 × 性格3パターン）:
    - perception-lag baseline 比で **block 件数が高 lag でも増加**: lag=5/8 で 52→80、lag=7/10 で 8→66。threat boost 半減にもかかわらず block 増加 = guardRangeBase 引き上げが「threat 立たなくても射程内ならガード選好」を機械的に実現。
    - 5劇（ジャブの賭け / ストレートは見てガード / 強ストレート vs ジャブ割り込み / フェイント誘発 / チップ崩し）すべて verify ログから読み取り可。phase3 完成版の質感を保持。
    - **lag=2/4 がスイートスポット**として浮上: プラン5基準（時間切れ<35% / KO中央300-600F / block:clean>0.5 / 殴り合い<40% / 5劇）を**すべて同時に満たす唯一のシナリオ**。
  - 残課題:
    - R1 発火: lag=0/0 で時間切れ 48/50 (96%)。プラン基準 35% を大幅超。**ただし verifier 推奨は「Step C を先に試してから判断」**（理念: 機械的に積む。Step C で上下打ち分けが意味を持つようになると lag=0 でも攻撃が通り R1 が緩和する見込み）。
    - lag=3-7 で block/clean<0.5: Step B 単独では構造的に解決できていない。Step C 待ち。
    - 両守備型 lag=3/5 のガード切替 43.8回/試合 — guardCommitment=0.5 が df=0.8 に対して継続バイアス弱い可能性（R3）。Step C 後にクロス感度分析を推奨。
  - guardCommitment 感度分析（0.3/0.5/0.7）は verify.js が CLI 引数未対応のため Step C 後にまとめて実施へ繰り越し。
- **段階3 (α) Step C 実装完了 → 段階3 (α) 完成**（詳細レポート: `reports/2026-05-27-defensive-ai-stepC-complete.html`）。
  - MOVES ガード6種の `guardSwapStartup` を 0→3 に変更。UI スライダー初期値も 0→3 に同期。
  - **既存バグ発覚と修正**: `tools/verify.js` の ELEM stub に `gcP/gcE/gsw` が未登録だったため、`build()` の MOVES/PERS 上書き処理で NaN → `|| 0` フォールバックされていた。**Step B の guardCommitment 効果は実は無効化されていた**（Step B の改善は guardScore 式変更だけの効果）。ELEM stub に3キー追加して両者有効化。
  - Step B レポートに retroactive 警告 panel を追加（バグ発覚の経緯と Step C 完成版へのリンク）。
  - 真の Step B+C 合成効果の観測:
    - 両守備型ペアでガード切替が大幅減（lag=3/5: 43.8→27.5回/試合 -37%、lag=5/8: 34.4→17.7回 -49%）。block/clean 0.70→0.77、時間切れ 38→18 と 19→9 で振動から機能への質的転換。
    - 非対称 lag=1/2 の劇的改善: ガ切替 16.8→10.6 (-37%)、時間切れ 29→18、P+E 勝 21→32。guardCommitment 効果の最大帯。
    - ガード切替コスト gsw=3 自体の効果は副次的（chip 比率の微増程度のマイルド）。主役は guardCommitment。
    - **lag=2/4 スイートスポット維持**: プラン5基準を引き続き同時クリア（時間切れ 6%、KO 中央 537F、block/clean 0.58、殴り合い 17.6%、5劇全て再現）。
  - 5劇全て保持: phase3 完成版の質感は Step C でも保たれている。
  - リスク判定:
    - R1 (lag=0/0 時間切れ) ⚠ 未解消だが改善方向 (96%→90%)。lag=0/0 は構造的に攻撃が読まれすぎる泥沼、Step C 単独では解決不能と確定。
    - R2 (KO 異常増) ✅ 未発火。フェイント効きすぎパターンなし、fnt 試行数はむしろ減少（攻撃側がフェイント無しで当てられる改善）。
    - R3 (guardCommitment×df 重複) ✅ 機能側に振れた（振動→機能の質的転換）。
  - 段階3 (α) 全体総括: #1 threat 依存 ✅ 構造的解消、#2 ガード切替コスト=0F ✅ 構造的解消、#3 一方的試合 ⚠ 部分解消（lag>=1 で均衡化、lag=0 は構造的不能）。
  - 次のステップ: **(B) lag 既定値再決定** へ移行可。verifier 推奨は第1候補 (p=2, d=4)、第2候補 (p=3, d=5)、補助 (p=1, d=2)。既定 (p=2, d=4) base にユーザー選択でプリセット併置の案。
- ユーザー提案: **段階4 「敵行動予測モデル」** の方向性が明示された。実物ボクサーの「スカウト + 試合中読み更新」を機械化する。既存決定軸ごとの確率分布、メタ層なし、A/B/C 分割で実装する方針が確定。プラン: `~/.claude/plans/ai-gleaming-hollerith.md`（段階3 (α) 完了後にプラン本体は段階4 用に差し替え、α 履歴は本 LOG.md と reports/ に保存）。理念整合: 「実物ボクサーが何を予測してるか」を機械化が動機、「フェイント効いてほしい」を逆算しない。
- **段階4 Step A 実装完了**（詳細レポート: `reports/2026-05-27-prediction-model-stepA.html`）。
  - 配管: PERS に `modelPrior`（4軸 attackTarget/guardTarget/state/attackKind の擬似カウント）/ `modelDecay`=0.99 / `modelTrust`=0 を追加。makeChar に `predictedCounts` / `predictedOpp` 追加。stepSim の progress() 後に `updatePrediction(s, "P"); updatePrediction(s, "E")` を呼ぶ。updatePrediction の順序は decay → 観測加算 → 正規化、**Math.random 不使用（R5 遵守）**。
  - buildObs 戻り値に `prediction` 追加、renderObs に「敵の次予測」パネル4軸表示。scoreActions は**一切変更せず**（Step A 流儀）。
  - **R6 (verify.js ELEM stub バグ) 予防**: Step A 着手時に build() 内の `num()` / `lag()` 全17 ID と ELEM stub を必須突合。未登録ゼロを確認（過去のバグ再発なし）。今後の Step でも UI 追加時はこの突合を必ず行う方針を確立。
  - **Identity Check PASS**: 編集前後の verify.js 出力 MD5 完全一致 (`6e43a3fabb2327bf2cecc4c80af9c64f`)。段階3 (α) Step C 完成時から bit-identical。
  - 予測モデル動作確認 (seed=100, 176F): state top-1 精度 **72.2%**（random 25% → +47pt）、attackTarget top-1 **58.5%**（random 50% → +8.5pt）、guardTarget 100%（サンプル小）。全 176/176 フレームで分布更新、毎フレーム計算が機能。
  - 次は Step B: scoreActions の oppGT/oppAtkT 分岐を soft 版に書き換え（観測なし時のみ予測ブレンド = 観測 > 予測原則）、modelTrust 既定 0.5 で有効化。
- **段階4 Step B 実装完了**（詳細レポート: `reports/2026-05-27-prediction-model-stepB.html`）。
  - scoreActions の oppGT / oppAtkT / threatened を soft 化。**観測 > 予測原則**: 観測あり時は従来通り hard 値、観測なし時 + trust>0 のみ予測でブレンド。trust=0 で完全フォールバック保証。
  - UI スライダー `mtP/mtE` 追加、verify.js ELEM stub に最初から登録（R6 教訓）。`MT` 環境変数でアブレーション可能。
  - **Identity Check PASS**: MT=0 で Step A baseline と意味的内容完全一致。verify.js MT 未指定時フォールバックは 0 のまま（HTML UI 既定 0.3 とは別管理、互換性維持）。
  - verifier 観測（MT 5値 × 13シナリオ × 50戦 = 3,250試合）:
    - MT 上昇でガード切替頻度が線形に増加（lag=3/5 で 3.2→12.8 = 4倍）。予測で先回りガードが機械的に機能。
    - MT 上昇で殴り合い率は単調低下（先読みガード → 当たらない → 殴り合い減）。
    - block/clean (lag=3/5) は MT 上昇で改善 (0.22→0.44)。段階3 (α) で構造的に解決できなかった「lag>=3 の守備機能性」を予測モデルが補強。
  - **当初プラン既定 MT=0.5 はプラン完了基準(2) を満たせず**（ガ切替 +122% で ±20% 大幅超、守備型ペア時間切れ 36→64%）。verifier 推奨で**既定値を 0.5 → 0.3 に調整**。理念整合の判断（機械的観察に基づく数値修正）。
  - MT=0.3 は lag=2/4 のスイートスポットを維持（時間切れ 4%、KO 中央 503F、5劇全て再現）しつつ、block/clean を 0.22→0.32 に改善、R2/R3 リスクを MT=0.5 比で半減。
  - リスク判定: R1 (低 lag 時間切れ悪化) 軽度、R2 (思い込み) MT≥0.7 で全面発火だが MT=0.3 では抑制、R3 (predictedCounts 発散) 守備型で症状あり（guardCommitment 強化が Step C 検討課題）、R5 (Identity Check) PASS。
  - 5劇は MT=0.3 lag=2/4 で全て再現。phase3 完成版の質感を保持。
  - Step C 着手前の課題（verifier 提示）: ①観測空白活用率の verify.js 指標化、②guardCommitment 感度分析 (α 段階からの保留)、③低 lag 時間切れ悪化の構造解明、④predictedAtkT の attacker 側効果検証（kind 分布が MT で不変）。
- **観測空白活用率 verify.js 指標化 完了**（Step C 前検討課題①）。tools/verify.js に追加: gapF_P/E（観察者が opp.attackTarget を観測できていないが相手は実際に攻撃中のフレーム数）と correctF_P/E（同フレーム中で観察者が正しいガード target で構えていたフレーム数）。集計表示 "観測空白活用率"。
  - 非対称 lag=2/4: MT=0→0.3→0.5 で 10.6% → 11.9% → **15.9%** (+5.3pt)。
  - 非対称 lag=3/5: 7.1% → 10.5% → 11.6% (+4.5pt)。
  - 結論1: **MT 線形に単調増加** → 予測モデルの直接効果が機械的に存在することの直接証拠。
  - 結論2: プラン基準「>30%」は届かず（最大 15.9%）。理由: 分母 gapF に観察者がガード態勢じゃない frames が含まれて分子を圧迫。絶対値ではなく**相対効果**を見る指標として機能（プラン時の 30% は想定ミス）。
- **ユーザーの設計洞察**: 「ガードが多くなってしまうのは、ガードが問題なのではなく、ガードを崩す攻撃がない事が問題」。理念整合の本質的な指摘。実物では (a)判定システム = ガードしすぎでポイント負け / (b)格闘ゲーム = 投げ・上下強制2択・ガードクラッシュ で「ガードへの代償」が存在する。現状 FSM にはこの代償が無いため、df を高めると守備が構造的最適解になる（α R3 / 段階4 Step B の MT 高守備過多の根本原因）。次の方向は段階5 候補として「ガードを崩す機構」をブレスト→設計の流れ。
- ユーザー判断: B (ガード継続スタミナペナルティ) は保留（スタミナ見直しと一緒に）/ C (ガードクラッシュ) は要設計 / D (上下強制) は既に実装済み相当 / **A (判定システム) を先に実装したい**（ただしラウンド概念が無いので、まずラウンドシステムから）。**段階5 = ラウンドシステム + 判定システム** として確定。プラン: `~/.claude/plans/ai-gleaming-hollerith.md`（段階4 プラン本体は段階5 用に差し替え、段階4 履歴は reports/ と本 LOG.md に保存）。
- **段階5 Step A 実装完了**（詳細レポート: `reports/2026-05-27-round-system-stepA.html`）。
  - 配管: グローバル定数 `ROUND_LENGTH=300, NUM_ROUNDS=3, INTERVAL_LENGTH=60, STAMINA_INTERVAL_REGEN=2.0`（全て let で UI 変更可能）、`roundEnabled=false`（Step A 既定）を追加。
  - initSim に `s.round=1, s.roundFrame=0, s.matchPhase="active", s.roundScores=[], s.roundStats={P,E:{clean,chip,blocks,counters}}, s.decision=null, s.ended=false` を追加。
  - stepSim 末尾で `s.roundFrame++`（境界判定はせず）。
  - UI: `#roundDisplay` placeholder + ラウンド設定入力欄（チェックボックス + 4 数値入力）。
  - verify.js: ELEM stub に新 ID 5個（roundEnabled/roundLength/numRounds/intervalLength/regenRate）を**最初から登録**（R6 教訓遵守）。runMatch 戻り値に `rounds: []` 追加。
  - **Identity Check PASS**: MT=0 で編集前後の verify.js 出力 MD5 完全一致 (`81eb68488e55b9902d1010da41d7dd71`)。`roundEnabled=false` 既定で従来挙動 bit-identical 達成。
  - 次は Step B: roundEnabled=true 既定化、ラウンド境界検出 + 部分リセット + インターバル処理（スタミナ回復、AI スキップ、predictedCounts decay 停止）+ UI 進行表示。
- **段階5 Step B 実装完了**（詳細レポート: `reports/2026-05-27-round-system-stepB.html`）。
  - 主な変更: roundEnabled=true 既定化、新関数4つ追加 (`partialReset / endRound / startRound / stepInterval`)、stepSim 分岐 (active/interval/ended)、roundStats 累積 (blocks/clean/chip/counter)、UI #roundDisplay 切替、updatePrediction の interval スキップ（R2 対策）。
  - 副次修正: MAX_FRAME を動的計算化 (`computeMaxFrame()`)。roundEnabled=true 時 1070F (3R×300+2×60+50)、false 時 800F。これで 3R 試合が MAX_FRAME 制約で打ち切られない設計に。
  - partialReset 状態管理: HP/stamina/predictedCounts は持ち越し、フレーム状態 (moveKey/phase/fip/stun/stopRec/decTimer/plan/scores) はリセット、x は INIT_X_P/E に戻す。実物ボクシングの「コーナーで休憩」を機械化。
  - **Identity Fallback PASS**: roundEnabled=false で MAX_FRAME=800、MD5 `81eb68488e55b9902d1010da41d7dd71` baseline と完全一致。
  - **時間切れの激減**: 非対称 p1/d2 で 29→2、両守備 p3/d5 で 29→2、両守備 p5/d8 で 12→0、p0/d0 で 43→22。「ラウンド境界で AI/距離がリセットされ停滞ループから抜ける」効果が機械的に明確。
  - **スイートスポット p2/d4 維持**: 540.5F / KO=510F / 時間切れ 0 / ガ切替 4.7 / 殴り合い 16.5% で baseline と整合（±7%）。プラン要件達成。
  - 5劇全て継続再現。R1/R3/R4/R5/R6 リスクは未発火（R5 Identity PASS）。R2 は MT=0 のため検証不完全、MT=0.3 再測が Step C 前推奨。
  - **守備型 p3/d5 で KO 中央 615→742F (+20%)** ← 「ガード崩す機構未実装」の構造的問題を機械的に裏付け。**Step C 判定システムの必要性が観測で裏付けられた**。
  - Step C 着手前の課題: ①MT=0.3 再測 ②verify.js を rounds/roundStats 内訳ダンプ対応に拡張 ③インターバル スタミナ回復の直接観測指標 ④ラウンドごとの clean 偏り（前後半）。
- **段階5 Step C 実装完了 → 段階5 配管完成**（詳細レポート: `reports/2026-05-27-round-system-stepC-complete.html`）。
  - 採点関数 `scoreRound(stats)`: 「有効打」= clean + 0.3×chip、差<1 で 10-10、差<10 で 10-9、それ以上で 10-8
  - 最終判定 `computeDecision(s)`: 累計ポイント比較で winner=P/E/draw
  - endRound 拡張で scoreRound 呼出、roundScores に pPoint/ePoint 格納、startRound で NUM_ROUNDS 超で computeDecision 確定
  - UI: #status で KO / 判定決着 / 試合中 出し分け、charCard でラウンド毎ポイント + 累計表示
  - 副次修正: `computeMaxFrame()` の式を `NUM_ROUNDS * (ROUND_LENGTH + INTERVAL_LENGTH) + 50` に修正（最終R後インターバルもカバー）。1070→1130F
  - verify.js: runMatch 戻り値に `decision` 追加、aggregate に判定統計+ラウンド傾向集計（R1/R2/R3 clean）
  - **Identity Fallback PASS**: roundEnabled=false で Step B baseline (`021cb52050c855823089c9b9cd360129`) と完全一致
  - verifier 観測 (MT=0.3、50戦) の重要発見:
    - **時間切れ完全消滅**: 全シナリオ 0/50（ラウンド構造と MAX_FRAME 修正の効果）
    - **スイートスポット (3/5) 維持**: KO中央 434F、5基準 4/5 ◯
    - **判定到達率がほぼ 0%**: lag=2/4 以降全試合 KO で決着、判定が「飾り」状態
    - **「守備一辺倒で判定負け」未達**: 判定発生条件下（非対称 0/0、両守備3/5）で守備側が勝ち越す傾向。chip 係数 0.3 が弱い可能性
    - 後半 clean 増（スタミナ回復効果）は明確に観測されず（R1 が最も活発で逓減傾向）
    - 5劇は全て再現、ただし「判定経由の逆転劇」はまだ薄い
  - 段階5 全体総括: 配管完成 / 設計目標部分達成。「ラウンド + 判定」機構は組まれたが「ガード崩しの代償化」には別機構（採点係数調整 or ガード崩し攻撃強化）が必要、と機械的に判明。これは理念整合（「機械的に観察された結果」として次の方向を導出）。
  - 次の方向の候補: ①ガード崩し機構 (C ガードクラッシュ・採点係数引き上げ等) ②段階4 Step C ③lag 再決定 ④判定発火条件拡張（HP 残存率算入）⑤R5 詳細調査（10-9/10-8 内訳）。
- **次候補の比較レポート作成**（詳細: `reports/2026-05-27-next-candidates-comparison.html`）。段階5 配管完成後の5候補（採点係数調整 / HP残存率算入 / ガード崩し攻撃 C / 段階4 Step C / lag 再決定）を機械的観察ベースで比較。決定は保留。

## 2026-05-28
- **予測強度・KO実体の検証**（詳細: `reports/2026-05-28-prediction-strength-ko-artifact.html`）。ユーザーの2疑問を実測。Q1: KO増加はほぼ見かけ（旧800F単発の時間切れが3RでKOに変換、round構造が停滞をKO化）。Q2: 予測強度MTを上げると判定到達率が単調増加（両守備3/5: 4→28%、非対称0/0: 44→64%、MT0→0.9）=『推論で判定勝負が増える』仮説を支持。ただし高lag帯は観測空白で予測が効かず判定率ほぼ0。前回の『chip弱い→ガード崩し必要』結論は見かけKOに引きずられた早計と判明。verify.js は MD5 不変・無編集。次の方向は未決定。
