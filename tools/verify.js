// index.html の <script> を Node の vm で評価し、シム関数だけ呼び出すハーネス。
// 段階2 Step B/C 検証用: 頭/腹打ち分けの効果を観察。head/body を分けて集計。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const m = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/);
if (!m) { console.error("script not found"); process.exit(1); }
let script = m[1].replace(/^(let|const)\s+/gm, "var ");

const ELEM = {
  aiP: { checked: true }, aiE: { checked: true },
  agP: { value: "60" }, dfP: { value: "40" }, paP: { value: "30" }, rangeP: { value: "2.5" }, saP: { value: "50" }, plagP: { value: "3" }, dlagP: { value: "5" }, gcP: { value: "50" }, mtP: { value: "30" },
  agE: { value: "40" }, dfE: { value: "60" }, paE: { value: "40" }, rangeE: { value: "3.0" }, saE: { value: "50" }, plagE: { value: "3" }, dlagE: { value: "5" }, gcE: { value: "50" }, mtE: { value: "30" },
  gsw: { value: "3" },
  seqP: { value: "" }, seqE: { value: "" }, speed: { value: "200" },
  // 段階5 Step B: ラウンドシステム UI（既定 true）。
  // 手動で false に切り替えるとフォールバック Identity Check（baseline MD5 一致）を確認できる。
  roundEnabled: { checked: true },
  roundLength: { value: "300" },
  numRounds: { value: "3" },
  intervalLength: { value: "60" },
  regenRate: { value: "2.0" },
};
const stubElem = (id) => new Proxy(ELEM[id] ?? {}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === "innerHTML" || k === "textContent") return "";
    return undefined;
  },
  set(t, k, v) { t[k] = v; return true; },
});
const stubQ = { innerHTML: "", appendChild() {} };
const document = {
  getElementById: stubElem,
  querySelector: () => stubQ,
  querySelectorAll: () => [],
  createElement: () => ({ innerHTML: "" }),
};
const sandbox = {
  document, console, Math, JSON,
  parseInt, parseFloat, isNaN,
  setInterval: () => null, clearInterval: () => {},
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
const S = sandbox;

// 段階5 Step B fix: 動的 MAX_FRAME を verify でも反映。
//   index.html の build() でやっている「ラウンド設定読込 → MAX_FRAME = computeMaxFrame()」を
//   verify.js でも再現する。ELEM stub の値 (roundEnabled.checked / roundLength / numRounds / intervalLength) を
//   サンドボックスのグローバルに反映してから computeMaxFrame() を呼ぶ。
function syncRoundConfigFromELEM() {
  S.roundEnabled = !!(ELEM.roundEnabled && ELEM.roundEnabled.checked);
  const rLen = parseFloat(ELEM.roundLength.value);
  const nR   = parseFloat(ELEM.numRounds.value);
  const iLen = parseFloat(ELEM.intervalLength.value);
  if (!isNaN(rLen) && rLen > 0) S.ROUND_LENGTH = Math.round(rLen);
  if (!isNaN(nR)   && nR   > 0) S.NUM_ROUNDS   = Math.round(nR);
  if (!isNaN(iLen) && iLen >= 0) S.INTERVAL_LENGTH = Math.round(iLen);
  S.MAX_FRAME = S.computeMaxFrame();
  return S.MAX_FRAME;
}
{
  const mf = syncRoundConfigFromELEM();
  console.log(`[verify] MAX_FRAME=${mf} (roundEnabled=${S.roundEnabled}, NUM_ROUNDS=${S.NUM_ROUNDS}, ROUND_LENGTH=${S.ROUND_LENGTH}, INTERVAL_LENGTH=${S.INTERVAL_LENGTH})`);
}

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 技名から kind を返す: "ストレート" → "str", "強ストレート上" → "hvy" 等
function classifyAtk(atkName) {
  if (!atkName) return null;
  if (atkName.startsWith("強ストレート")) return "hvy";
  if (atkName.startsWith("フェイント")) return "fnt";
  if (atkName.endsWith("ストレート")) return "str";   // ボディストレート, ストレート
  if (atkName.endsWith("ジャブ")) return "jab";       // ボディジャブ, ジャブ
  return null;
}

function runMatch(persP, persE, seed) {
  S.AI.P = true; S.AI.E = true;
  S.PERS.P = persP; S.PERS.E = persE;
  S.Math.random = mulberry32(seed);
  let s = S.initSim();
  S.frames = [s];
  let frames = 0;
  let pStaSum = 0, eStaSum = 0;
  let pStaZeroF = 0, eStaZeroF = 0;
  // 段階3: 行動種別ごとに数える。jab/str/heavy/feint × head/body × side
  const atk = {
    P: { jabH:0, jabB:0, strH:0, strB:0, hvyH:0, hvyB:0, fntH:0, fntB:0 },
    E: { jabH:0, jabB:0, strH:0, strB:0, hvyH:0, hvyB:0, fntH:0, fntB:0 },
  };
  // 技kind ごとの outcome（clean/slip/block/chip/counter） — 攻撃側視点
  const perKind = {
    jab: { clean:0, slip:0, block:0, chip:0, counter:0 },
    str: { clean:0, slip:0, block:0, chip:0, counter:0 },
    hvy: { clean:0, slip:0, block:0, chip:0, counter:0 },
    fnt: { clean:0, slip:0, block:0, chip:0, counter:0 },
  };
  // whiff 内訳: defender が何をしていたか
  const whiffCat = { evade:0, guardEvade:0, guardHold:0, guardAdvance:0, attacking:0, stunned:0, advancing:0, other:0 };
  const whiffByKind = {
    jab: { evade:0, guardEvade:0, other:0 },
    str: { evade:0, guardEvade:0, other:0 },
    hvy: { evade:0, guardEvade:0, other:0 },
  };
  // ヒット内訳（全体）
  let hitsClean = 0, hitsBlocked = 0, hitsSlipped = 0, chipBlocks = 0;
  let counters = 0;
  // Step A 追加: ガード切替頻度カウンタ。前フレームの (moveKey, guardTarget) と比較して、
  //   両方 guard 系で target が違ったらカウント。両者ぶん。
  const isGuardMoveKey = (k) => {
    if (!k) return false;
    const m = S.MOVES[k];
    return m && m.kind === "move" && m.guard;
  };
  const guardTargetOf = (k) => (isGuardMoveKey(k) ? (S.MOVES[k].target || null) : null);
  let prevPMove = s.P.moveKey, prevEMove = s.E.moveKey;
  let guardSwaps = 0;
  // Step A 追加: 殴り合い率 = 両者とも非ガード move/attack 状態のフレーム比。
  //   「非ガード move」= isMove かつ guard:false / 「非ガード attack」= isAttack 全部
  //   guard 中（その場ガード/ガード移動/ガード硬直）はカウントしない
  let brawlFrames = 0;
  const isBrawlState = (ch) => {
    if (ch.stun > 0) return false; // のけぞり / ガード硬直は除外
    const k = ch.moveKey;
    if (!k) return false; // 待機 = 攻防成立せず
    const m = S.MOVES[k];
    if (!m) return false;
    if (m.kind === "attack") return true;
    if (m.kind === "move" && !m.guard) return true;
    return false;
  };
  // 段階4 Step B 追加: 観測空白活用率 = 「相手の attackTarget が観測できていない（detailLag のせい）」
  //   かつ「相手は実は attack の startup/active」のフレームのうち、
  //   観察者が正しいガード target で構えていた割合。
  //   buildObs と同じく、observer の dLag = max(presenceLag, detailLag) を使い、
  //   過去 frames[s.frame - 1 - dLag] の opp 状態の moveKey から attackTarget を見る。
  let gapF_P = 0, gapF_E = 0, correctF_P = 0, correctF_E = 0;
  const isAttackMoveKey = (k) => {
    if (!k) return false;
    const m = S.MOVES[k];
    return m && m.kind === "attack";
  };
  // buildObs と同じスナップショット規則: histIdx<0 なら frames[0] にフォールバック
  const snapshotOpp = (sCur, oppKey, lag) => {
    if (lag <= 0) return sCur[oppKey];
    const histIdx = (sCur.frame - 1) - lag;
    const arr = S.frames;
    if (histIdx >= 0 && arr[histIdx] && arr[histIdx][oppKey]) return arr[histIdx][oppKey];
    if (arr.length > 0 && arr[0] && arr[0][oppKey]) return arr[0][oppKey];
    return sCur[oppKey];
  };
  const observedAttackTarget = (sCur, meKey, oppKey) => {
    const pers = S.PERS[meKey] || {};
    const pLag = pers.presenceLag || 0;
    const dLag = Math.max(pLag, pers.detailLag || 0);
    const oppDetail = snapshotOpp(sCur, oppKey, dLag);
    if (!isAttackMoveKey(oppDetail.moveKey)) return null;
    return S.MOVES[oppDetail.moveKey].target || null;
  };
  // 相手の「真の」攻撃 target を返す。phase が startup/active かつ stun==0 のときだけ有効。
  const trueAttackTargetIfActive = (ch) => {
    if (ch.stun > 0) return null;
    if (!isAttackMoveKey(ch.moveKey)) return null;
    if (ch.phase !== "startup" && ch.phase !== "active") return null;
    return S.MOVES[ch.moveKey].target || null;
  };
  while (frames < S.MAX_FRAME && !s.ko && !s.ended) {
    s = S.stepSim(s);
    S.frames.push(s);
    frames++;
    pStaSum += s.P.stamina;
    eStaSum += s.E.stamina;
    if (s.P.stamina <= 0) pStaZeroF++;
    if (s.E.stamina <= 0) eStaZeroF++;
    // ガード切替検出: 直前 moveKey が guard 系、現フレーム moveKey も guard 系、target が違う
    for (const [chKey, prevK] of [["P", prevPMove], ["E", prevEMove]]) {
      const curK = s[chKey].moveKey;
      if (isGuardMoveKey(prevK) && isGuardMoveKey(curK) && guardTargetOf(prevK) !== guardTargetOf(curK)) {
        guardSwaps++;
      }
    }
    prevPMove = s.P.moveKey;
    prevEMove = s.E.moveKey;
    // 殴り合い率: 両者とも非ガード状態のフレーム
    if (isBrawlState(s.P) && isBrawlState(s.E)) brawlFrames++;
    // 観測空白活用率: 両キャラを観察者として独立に判定
    //   観察者 me, 相手 opp について
    //   - opp の真の攻撃 target (startup/active 中だけ): trueTgt
    //   - me の opp 観測上の attackTarget: obsTgt
    //   - gap = (trueTgt !== null && obsTgt === null)
    //   - correct = gap && me がガード move 中 && そのガード target === trueTgt
    for (const [meKey, oppKey] of [["P", "E"], ["E", "P"]]) {
      const trueTgt = trueAttackTargetIfActive(s[oppKey]);
      if (trueTgt === null) continue;
      const obsTgt = observedAttackTarget(s, meKey, oppKey);
      if (obsTgt !== null) continue; // 観測できている → 空白ではない
      // ここから観測空白フレーム
      if (meKey === "P") gapF_P++; else gapF_E++;
      const meMoveK = s[meKey].moveKey;
      if (isGuardMoveKey(meMoveK) && guardTargetOf(meMoveK) === trueTgt) {
        if (meKey === "P") correctF_P++; else correctF_E++;
      }
    }
    for (const e of s.events) {
      if (e.type === "start") {
        // 「フェイント上」「強ストレート下」「ボディジャブ」「ストレート」など全種類
        const m = e.text.match(/^(Player|敵): 「(ボディ)?(フェイント|強ストレート|ジャブ|ストレート)([上下]?)」開始/);
        if (m) {
          const side = m[1] === "Player" ? "P" : "E";
          const isBody = !!m[2];          // 「ボディ」prefix
          const base = m[3];
          const suffix = m[4];            // 上/下
          let tgt;
          if (suffix === "上") tgt = "H";
          else if (suffix === "下") tgt = "B";
          else tgt = isBody ? "B" : "H";
          let kind;
          if (base === "ジャブ") kind = "jab";
          else if (base === "ストレート") kind = "str";
          else if (base === "強ストレート") kind = "hvy";
          else if (base === "フェイント") kind = "fnt";
          if (kind) atk[side][kind + tgt]++;
        }
      } else if (e.type === "block") {
        hitsBlocked++;
        const isChip = e.text.startsWith("ガード崩し");
        if (isChip) chipBlocks++;
        // 「ガード ${name}が「${atk}」を防御」または「ガード崩し ${name}が「${atk}」を防御」
        const mb = e.text.match(/「(.+?)」を防御/);
        if (mb) {
          const kind = classifyAtk(mb[1]);
          if (kind && perKind[kind]) {
            perKind[kind].block++;
            if (isChip) perKind[kind].chip++;
          }
        }
      } else if (e.type === "counter") {
        counters++;
        const isSlip = e.text.startsWith("すり抜け");
        if (isSlip) hitsSlipped++; else hitsClean++;
        // 「カウンター! ${name}「${atk}」-...」
        const mc = e.text.match(/「(.+?)」-/);
        if (mc) {
          const kind = classifyAtk(mc[1]);
          if (kind && perKind[kind]) perKind[kind].counter++;
        }
      } else if (e.type === "hit") {
        const isSlip = e.text.startsWith("すり抜け");
        if (isSlip) hitsSlipped++; else hitsClean++;
        const mh = e.text.match(/「(.+?)」-/);
        if (mh) {
          const kind = classifyAtk(mh[1]);
          if (kind && perKind[kind]) {
            if (isSlip) perKind[kind].slip++;
            else perKind[kind].clean++;
          }
        }
      } else if (e.type === "whiff") {
        // 「Whiff Player「ストレート」空振り [相手=ステップバック/evade, dist=4.20/reach=3.50]」
        const mw = e.text.match(/「(.+?)」空振り.*\/(\w+),/);
        if (mw) {
          const kind = classifyAtk(mw[1]);
          const cat = mw[2];
          if (whiffCat[cat] !== undefined) whiffCat[cat]++;
          if (kind && whiffByKind[kind]) {
            if (cat === "evade") whiffByKind[kind].evade++;
            else if (cat === "guardEvade") whiffByKind[kind].guardEvade++;
            else whiffByKind[kind].other++;
          }
        }
      }
    }
  }
  return {
    frames, ko: s.ko,
    hp: { P: s.P.hp, E: s.E.hp },
    sta: { P: +s.P.stamina.toFixed(1), E: +s.E.stamina.toFixed(1) },
    staAvg: { P: +(pStaSum / frames).toFixed(1), E: +(eStaSum / frames).toFixed(1) },
    staZeroF: { P: pStaZeroF, E: eStaZeroF },
    atk,
    perKind,
    whiffCat,
    whiffByKind,
    hits: { clean: hitsClean, blocked: hitsBlocked, slipped: hitsSlipped, chip: chipBlocks, counters },
    // Step A 追加: ガード切替頻度（両者合計） / 殴り合い率
    guardSwaps,
    brawlFrames,
    brawlRate: frames ? +(brawlFrames / frames).toFixed(3) : 0,
    // 段階4 Step B 追加: 観測空白活用率 (両キャラ独立)
    gapF: { P: gapF_P, E: gapF_E },
    correctF: { P: correctF_P, E: correctF_E },
    // 段階5 Step A 追加: ラウンドスコア配管（Step A は常に空配列、Step C で埋まる）
    rounds: s.roundScores || [],
    // 段階5 Step C 追加: 最終判定。KO 決着時は null（ended に到達せず）、判定決着時は { winner, pTotal, eTotal }。
    decision: s.decision || null,
    // 段階5 Step C 追加: ラウンド終了 frame 数（前/後半 clean 集計用に runMatch 内では返さず、後段で rounds から算出）
  };
}

// 段階3 多段知覚: presenceLag=3 / detailLag=5 既定。
// 段階4 Step B: modelTrust を env MT で切替可能（既定 0、Identity Check 用）。
//   MT=0   → 予測未使用、Step A baseline と完全一致を期待
//   MT=0.5 → 予測ブレンド有効。modelPrior も既定で渡す（updatePrediction が動くため）
const MT = (() => {
  const v = parseFloat(process.env.MT);
  return isNaN(v) ? 0 : v;
})();
const defaultModelPrior = () => ({
  attackTarget: { head: 50, body: 50 },
  guardTarget:  { head: 50, body: 50 },
  state:        { idle: 25, attack: 25, guard: 25, move: 25 },
  attackKind:   { jab: 40, str: 30, hvy: 15, feint: 15 },
});
const MODEL_PARTS = () => ({ modelPrior: defaultModelPrior(), modelDecay: 0.99, modelTrust: MT });
// 注: guardCommitment は従来 verify.js 既定で undefined → scoreActions 内 (p.guardCommitment || 0) = 0 扱い。
//   Identity Check のため敢えてここでは追加しない（Step A baseline を保持）。
const baseP = { ag: 0.60, df: 0.40, pa: 0.30, range: 2.5, presenceLag: 3, detailLag: 5, ...MODEL_PARTS() };
const baseE = { ag: 0.40, df: 0.60, pa: 0.40, range: 3.0, presenceLag: 3, detailLag: 5, ...MODEL_PARTS() };
console.log(`[verify] MT=${MT} (modelTrust 既定。MT=0 で Step A 完全一致、MT=0.5 で予測ブレンド有効)`);

// Step A 拡張: lag スキャン 4段 → 7段
const LAG_SCAN = [[0, 0], [1, 2], [2, 4], [3, 5], [4, 6], [5, 8], [7, 10]];

// --- 単発比較: 同 seed × (presenceLag, detailLag) ---
console.log("=== 単発比較 (同 seed × 知覚遅延 違い)  sa=0.5 / atk: j=jab s=str h=heavy f=feint, H/B=頭/腹 ===");
for (const seed of [1, 2, 3]) {
  console.log(`\n--- seed=${seed} ---`);
  for (const [pl, dl] of LAG_SCAN) {
    const persP = { ...baseP, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
    const persE = { ...baseE, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
    const r = runMatch(persP, persE, seed);
    const winner = r.ko ? r.ko.winner : "—（時間切れ）";
    const pAtk = `j${r.atk.P.jabH}/${r.atk.P.jabB} s${r.atk.P.strH}/${r.atk.P.strB} h${r.atk.P.hvyH}/${r.atk.P.hvyB} f${r.atk.P.fntH}/${r.atk.P.fntB}`;
    const eAtk = `j${r.atk.E.jabH}/${r.atk.E.jabB} s${r.atk.E.strH}/${r.atk.E.strB} h${r.atk.E.hvyH}/${r.atk.E.hvyB} f${r.atk.E.fntH}/${r.atk.E.fntB}`;
    console.log(
      `(p${pl}/d${dl}): ${String(r.frames).padStart(3)}F 勝者=${winner} HP ${r.hp.P}/${r.hp.E}\n` +
      `   攻撃P: ${pAtk}\n` +
      `   攻撃E: ${eAtk}\n` +
      `   ヒット: clean=${r.hits.clean} block=${r.hits.blocked}(chip=${r.hits.chip}) slip=${r.hits.slipped} counter=${r.hits.counters}`
    );
  }
}

// --- 集計関数 ---
function aggregate(label, persP, persE, n) {
  let pWin = 0, eWin = 0, draw = 0, sumF = 0, koF = [];
  let pStaAvgSum = 0, eStaAvgSum = 0;
  let pStaZeroFAll = 0, eStaZeroFAll = 0;
  const at = {
    P: { jabH:0, jabB:0, strH:0, strB:0, hvyH:0, hvyB:0, fntH:0, fntB:0 },
    E: { jabH:0, jabB:0, strH:0, strB:0, hvyH:0, hvyB:0, fntH:0, fntB:0 },
  };
  const pk = {
    jab: { clean:0, slip:0, block:0, chip:0, counter:0 },
    str: { clean:0, slip:0, block:0, chip:0, counter:0 },
    hvy: { clean:0, slip:0, block:0, chip:0, counter:0 },
    fnt: { clean:0, slip:0, block:0, chip:0, counter:0 },
  };
  const wCat = { evade:0, guardEvade:0, guardHold:0, guardAdvance:0, attacking:0, stunned:0, advancing:0, other:0 };
  const wKind = {
    jab: { evade:0, guardEvade:0, other:0 },
    str: { evade:0, guardEvade:0, other:0 },
    hvy: { evade:0, guardEvade:0, other:0 },
  };
  let hClean = 0, hBlock = 0, hSlip = 0, hChip = 0, hCounter = 0;
  // Step A 追加: ガード切替頻度 / 殴り合いフレーム
  let gSwaps = 0, brawlF = 0, totalF = 0;
  // 段階4 Step B 追加: 観測空白活用率 集計
  let gapP = 0, gapE = 0, corP = 0, corE = 0;
  // 段階5 Step C 追加: 判定統計とラウンド傾向。
  //   koP/koE: KO 勝ち、decP/decE/decDraw: 判定決着、timeout: ended/ko どちらにも至らず MAX_FRAME 到達。
  let koP = 0, koE = 0, decP = 0, decE = 0, decDraw = 0, timeout = 0;
  //   roundCleanSum[r] = { P: sum, E: sum, n: 試合数 } で各ラウンド (1..NUM_ROUNDS) の clean を平均化。
  const roundCleanSum = {};
  for (let i = 0; i < n; i++) {
    const r = runMatch(persP, persE, 100 + i);
    if (r.ko?.winner === "Player") pWin++;
    else if (r.ko?.winner === "敵") eWin++;
    else draw++;
    // 段階5 Step C: 決着内訳
    if (r.ko?.winner === "Player") koP++;
    else if (r.ko?.winner === "敵") koE++;
    else if (r.decision) {
      if (r.decision.winner === "P") decP++;
      else if (r.decision.winner === "E") decE++;
      else decDraw++;
    } else {
      timeout++;
    }
    // 段階5 Step C: ラウンド毎 clean 集計（試合途中で KO した場合はその R までしか含まれない）
    for (const rs of r.rounds) {
      if (!roundCleanSum[rs.round]) roundCleanSum[rs.round] = { P: 0, E: 0, n: 0 };
      roundCleanSum[rs.round].P += rs.pStats.clean;
      roundCleanSum[rs.round].E += rs.eStats.clean;
      roundCleanSum[rs.round].n++;
    }
    sumF += r.frames;
    if (r.ko) koF.push(r.frames);
    pStaAvgSum += r.staAvg.P;
    eStaAvgSum += r.staAvg.E;
    pStaZeroFAll += r.staZeroF.P;
    eStaZeroFAll += r.staZeroF.E;
    for (const side of ["P", "E"]) for (const k of Object.keys(at.P)) at[side][k] += r.atk[side][k];
    for (const kind of Object.keys(pk)) for (const ev of Object.keys(pk[kind])) pk[kind][ev] += r.perKind[kind][ev];
    for (const c of Object.keys(wCat)) wCat[c] += r.whiffCat[c];
    for (const kind of Object.keys(wKind)) for (const c of Object.keys(wKind[kind])) wKind[kind][c] += r.whiffByKind[kind][c];
    hClean += r.hits.clean; hBlock += r.hits.blocked; hSlip += r.hits.slipped;
    hChip += r.hits.chip; hCounter += r.hits.counters;
    gSwaps += r.guardSwaps;
    brawlF += r.brawlFrames;
    totalF += r.frames;
    gapP += r.gapF.P; gapE += r.gapF.E;
    corP += r.correctF.P; corE += r.correctF.E;
  }
  koF.sort((a, b) => a - b);
  const med = koF.length ? koF[Math.floor(koF.length / 2)] : "—";
  const pTot = at.P.jabH+at.P.jabB+at.P.strH+at.P.strB+at.P.hvyH+at.P.hvyB;
  const eTot = at.E.jabH+at.E.jabB+at.E.strH+at.E.strB+at.E.hvyH+at.E.hvyB;
  const pBodyR = pTot ? (((at.P.jabB+at.P.strB+at.P.hvyB)/pTot)*100).toFixed(0) : "—";
  const eBodyR = eTot ? (((at.E.jabB+at.E.strB+at.E.hvyB)/eTot)*100).toFixed(0) : "—";
  console.log(`\n=== ${label} (${n}戦) ===`);
  console.log(`P勝=${pWin}  E勝=${eWin}  時間切れ=${draw}  平均F=${(sumF/n).toFixed(1)}  KO中央値=${med}`);
  console.log(`スタミナ平均: P=${(pStaAvgSum/n).toFixed(1)} E=${(eStaAvgSum/n).toFixed(1)}  スタ0F合計: P=${pStaZeroFAll} E=${eStaZeroFAll}`);
  console.log(`総攻撃 P: jab${at.P.jabH}/${at.P.jabB} str${at.P.strH}/${at.P.strB} hvy${at.P.hvyH}/${at.P.hvyB} fnt${at.P.fntH}/${at.P.fntB} (body率=${pBodyR}%)`);
  console.log(`総攻撃 E: jab${at.E.jabH}/${at.E.jabB} str${at.E.strH}/${at.E.strB} hvy${at.E.hvyH}/${at.E.hvyB} fnt${at.E.fntH}/${at.E.fntB} (body率=${eBodyR}%)`);
  console.log(`ヒット内訳: clean=${hClean} block=${hBlock}(chip=${hChip}) slip=${hSlip} counter=${hCounter}`);
  // 段階3: 技 kind ごとの outcome 集計（攻撃側視点）。
  //   試行=両者の合計、contact=clean+slip+counter+block (フェイントは active=0 なので contact ≒ 0)
  //   ガード率 = block/contact, 被弾率 = (clean+slip+counter)/contact, whiff率 = (試行-contact)/試行
  console.log(`--- 技 kind ごとの outcome ---`);
  console.log(`kind        |  試行 contact whiff% | clean  slip  cntr  block(chip) | ガード率 被弾率`);
  for (const [kind, label2] of [["jab","ジャブ系"],["str","ストレート系"],["hvy","強ストレート系"],["fnt","フェイント系"]]) {
    const trials = at.P[kind+"H"]+at.P[kind+"B"]+at.E[kind+"H"]+at.E[kind+"B"];
    const o = pk[kind];
    const contact = o.clean + o.slip + o.counter + o.block;
    const hits = o.clean + o.slip + o.counter;
    const whiffRate = trials ? ((trials-contact)/trials*100).toFixed(0) : "—";
    const gRate = contact ? (o.block/contact*100).toFixed(0) : "—";
    const hRate = contact ? (hits/contact*100).toFixed(0) : "—";
    console.log(
      `${label2.padEnd(11)} | ${String(trials).padStart(5)} ${String(contact).padStart(6)} ${String(whiffRate).padStart(4)}% | ` +
      `${String(o.clean).padStart(5)} ${String(o.slip).padStart(5)} ${String(o.counter).padStart(5)} ${String(o.block).padStart(5)}(${String(o.chip).padStart(3)}) | ` +
      `${String(gRate).padStart(6)}% ${String(hRate).padStart(6)}%`
    );
  }
  // --- whiff の内訳: defender が何をしていたか ---
  const wTot = Object.values(wCat).reduce((a,b)=>a+b,0);
  console.log(`--- whiff 内訳（${wTot}件中、defender の状態） ---`);
  const pct = v => wTot ? ((v/wTot)*100).toFixed(0) : "0";
  console.log(
    `  意図的回避  step/後退=${wCat.evade}(${pct(wCat.evade)}%) ガード後退=${wCat.guardEvade}(${pct(wCat.guardEvade)}%)`
  );
  console.log(
    `  ガード姿勢  その場=${wCat.guardHold}(${pct(wCat.guardHold)}%) ガード前進=${wCat.guardAdvance}(${pct(wCat.guardAdvance)}%)`
  );
  console.log(
    `  非ガード    攻撃中=${wCat.attacking}(${pct(wCat.attacking)}%) のけぞり=${wCat.stunned}(${pct(wCat.stunned)}%) 前進=${wCat.advancing}(${pct(wCat.advancing)}%) その他=${wCat.other}(${pct(wCat.other)}%)`
  );
  console.log(`--- 攻撃 kind 別: whiff の原因 ---`);
  for (const kind of ["jab", "str", "hvy"]) {
    const w = wKind[kind];
    const tot = w.evade + w.guardEvade + w.other;
    const intentional = w.evade + w.guardEvade;
    const intRate = tot ? ((intentional/tot)*100).toFixed(0) : "—";
    console.log(`  ${kind.padEnd(4)}: total=${String(tot).padStart(4)}  意図的回避=${String(intentional).padStart(3)}(${String(intRate).padStart(2)}%)  非意図=${String(w.other).padStart(4)}`);
  }
  // Step A 追加: ガード切替頻度 / 殴り合い率
  const brawlPct = totalF ? ((brawlF / totalF) * 100).toFixed(1) : "—";
  console.log(`--- 段階3 (α) Step A 新指標 ---`);
  console.log(`  ガード切替/試合: ${(gSwaps/n).toFixed(1)}回 (両者合計 ${gSwaps}回 / ${n}戦)`);
  console.log(`  殴り合い率: ${brawlPct}% (両者とも非ガード move/attack のフレーム比)`);
  // 段階4 Step B 追加: 観測空白活用率
  const utilP = gapP ? ((corP / gapP) * 100).toFixed(1) : "—";
  const utilE = gapE ? ((corE / gapE) * 100).toFixed(1) : "—";
  const gapBoth = gapP + gapE;
  const corBoth = corP + corE;
  const utilBoth = gapBoth ? ((corBoth / gapBoth) * 100).toFixed(1) : "—";
  console.log(`  観測空白活用率: P=${utilP}% (${corP}/${gapP}F) E=${utilE}% (${corE}/${gapE}F) 両者=${utilBoth}% (${corBoth}/${gapBoth}F)`);
  // --- 段階5 Step C 判定統計 ---
  console.log(`--- 段階5 Step C 判定統計 ---`);
  console.log(`  KO 勝ち: P=${koP} / E=${koE} (合計 ${koP+koE}/${n})`);
  console.log(`  判定勝ち: P=${decP} / E=${decE} / ドロー=${decDraw} (合計 ${decP+decE+decDraw}/${n})`);
  console.log(`  時間切れ: ${timeout}/${n} (ラウンド構造で発生しないはず、確認用)`);
  // ラウンド傾向: 各ラウンドの clean 平均
  const roundKeys = Object.keys(roundCleanSum).sort((a, b) => Number(a) - Number(b));
  if (roundKeys.length) {
    console.log(`  ラウンド傾向 (clean 平均, n=試合数):`);
    for (const rk of roundKeys) {
      const rc = roundCleanSum[rk];
      const pAvg = rc.n ? (rc.P / rc.n).toFixed(1) : "—";
      const eAvg = rc.n ? (rc.E / rc.n).toFixed(1) : "—";
      console.log(`    R${rk}: P=${pAvg} / E=${eAvg}  (n=${rc.n})`);
    }
  }
}

// --- 集計: 知覚遅延 違いで 50戦（sa=0.5 固定、非対称 baseP/baseE）---
for (const [pl, dl] of LAG_SCAN) {
  const persP = { ...baseP, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
  const persE = { ...baseE, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
  aggregate(`非対称 presence=${pl}F / detail=${dl}F`, persP, persE, 50);
}

// Step A 追加: 性格パターン3ケース × lag=3/5 と lag=5/8 を回す
//   - 両者攻撃型: 両方 ag=0.8 / df=0.2
//   - 両者守備型: 両方 ag=0.2 / df=0.8
//   - 攻撃 vs 守備: P=ag0.8/df0.2、E=ag0.2/df0.8（非対称・既存 baseP/baseE と類似）
const PERS_PATTERNS = [
  { label: "両者攻撃型 (ag=0.8 df=0.2)", P: { ag: 0.8, df: 0.2 }, E: { ag: 0.8, df: 0.2 } },
  { label: "両者守備型 (ag=0.2 df=0.8)", P: { ag: 0.2, df: 0.8 }, E: { ag: 0.2, df: 0.8 } },
  { label: "攻撃 vs 守備 (P=攻 E=守)",   P: { ag: 0.8, df: 0.2 }, E: { ag: 0.2, df: 0.8 } },
];
console.log("\n\n##############################################");
console.log("# Step A 追加: 性格パターン3ケース × lag=3/5, 5/8");
console.log("##############################################");
for (const pat of PERS_PATTERNS) {
  for (const [pl, dl] of [[3, 5], [5, 8]]) {
    const persP = { ...baseP, ...pat.P, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
    const persE = { ...baseE, ...pat.E, staminaAware: 0.5, presenceLag: pl, detailLag: dl };
    aggregate(`${pat.label}  p=${pl}F / d=${dl}F`, persP, persE, 50);
  }
}
