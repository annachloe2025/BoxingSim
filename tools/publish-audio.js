// レポートの読み上げ原稿(audio/scripts/*.txt)を edge-tts(Nanami)で音声化し、
// 音声ページ audio.html を作り直して、最新10件だけ残し、GitHub へ公開する。
//
// 使い方:
//   node tools/publish-audio.js            … 生成＋公開（push まで）
//   node tools/publish-audio.js --no-push  … 生成だけ（git は触らない／テスト用）
//
// Stop フックから自動起動される想定。冪等：新規が無ければ何もしない。
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'audio');
const SCRIPTS_DIR = path.join(AUDIO_DIR, 'scripts');
const REPORTS_DIR = path.join(ROOT, 'reports');
const AUDIO_PAGE = path.join(ROOT, 'audio.html');
const VOICE = 'ja-JP-NanamiNeural';
const KEEP = 10;
const NO_PUSH = process.argv.includes('--no-push');

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reportTitle(base) {
  const f = path.join(REPORTS_DIR, base + '.html');
  if (fs.existsSync(f)) {
    const m = fs.readFileSync(f, 'utf8').match(/<title[^>]*>([^<]*)<\/title>/i);
    if (m) return m[1].trim();
  }
  return base;
}

// 1) mp3 が無い原稿を音声化
function generateMissingAudio() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  const made = [];
  for (const s of fs.readdirSync(SCRIPTS_DIR).filter(f => f.toLowerCase().endsWith('.txt'))) {
    const base = s.replace(/\.txt$/i, '');
    const mp3 = path.join(AUDIO_DIR, base + '.mp3');
    if (fs.existsSync(mp3)) continue;
    const txt = path.join(SCRIPTS_DIR, s);
    try {
      execSync(`python -m edge_tts --voice ${VOICE} --file "${txt}" --write-media "${mp3}"`,
        { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      made.push(base);
      console.log(`音声生成: ${base}.mp3`);
    } catch (e) {
      console.error(`音声生成失敗: ${base} -> ${(e.stderr || e.stdout || e.message || '').toString().trim()}`);
    }
  }
  return made;
}

// 2) 最新10件だけ残し、古い mp3 と原稿を削除
function prune() {
  if (!fs.existsSync(SCRIPTS_DIR)) return;
  const bases = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.toLowerCase().endsWith('.txt'))
    .map(f => f.replace(/\.txt$/i, ''))
    .sort((a, b) => b.localeCompare(a)); // 日付プレフィックスで降順
  for (const base of bases.slice(KEEP)) {
    for (const p of [path.join(AUDIO_DIR, base + '.mp3'), path.join(SCRIPTS_DIR, base + '.txt')]) {
      if (fs.existsSync(p)) { fs.rmSync(p); console.log(`削除: ${path.relative(ROOT, p)}`); }
    }
  }
}

// 3) 音声ページ audio.html を生成（mp3 が存在するものだけ、新しい順、最新10件）
function buildAudioPage() {
  let items = [];
  if (fs.existsSync(AUDIO_DIR)) {
    items = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.toLowerCase().endsWith('.mp3'))
      .map(f => f.replace(/\.mp3$/i, ''))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, KEEP)
      .map(base => ({ base, date: (base.match(/^(\d{4}-\d{2}-\d{2})/) || ['', ''])[1], title: reportTitle(base) }));
  }

  const cards = items.map(it => `      <article class="card">
        <div class="date">${esc(it.date)}</div>
        <h2>${esc(it.title)}</h2>
        <audio controls preload="none" src="audio/${esc(it.base)}.mp3"></audio>
        <div class="links"><a href="reports/${esc(it.base)}.html">レポート全文</a></div>
      </article>`).join('\n');

  const out = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BoxingSim 音声レポート</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px 14px 60px; background: #0f1115; color: #e6e8eb;
         font-family: -apple-system, "Segoe UI", system-ui, sans-serif; line-height: 1.5; }
  header h1 { font-size: 1.25rem; margin: 0 0 2px; color: #8fd3ff; }
  header .sub { color: #9aa0a6; font-size: .8rem; margin-bottom: 14px; }
  .card { background: #1c2229; border: 1px solid #2c343d; border-radius: 10px;
          padding: 14px 16px; margin: 0 0 14px; }
  .card .date { color: #8ab4f8; font-size: .72rem; letter-spacing: .04em; }
  .card h2 { font-size: 1rem; margin: 4px 0 10px; font-weight: 600; }
  .card audio { width: 100%; }
  .card .links { margin-top: 8px; font-size: .8rem; }
  .card .links a { color: #ffd27d; text-decoration: none; }
  .empty { color: #9aa0a6; }
  footer { margin-top: 24px; font-size: .78rem; }
  footer a { color: #8ab4f8; }
</style>
</head>
<body>
  <header>
    <h1>BoxingSim 音声レポート</h1>
    <div class="sub">最新 ${items.length} 件 ・ 新しい順</div>
  </header>
  <main>
${cards || '    <p class="empty">まだ音声がありません。</p>'}
  </main>
  <footer><a href="README.html">← ダッシュボードへ</a></footer>
</body>
</html>
`;
  const prev = fs.existsSync(AUDIO_PAGE) ? fs.readFileSync(AUDIO_PAGE, 'utf8') : '';
  if (prev !== out) fs.writeFileSync(AUDIO_PAGE, out, 'utf8');
  return items.length;
}

// 4) 変更があれば公開
function publish() {
  git('add -A');
  if (!git('status --porcelain').trim()) {
    console.log('publish-audio: 変更なし。');
    return;
  }
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  git(`commit -m "auto: 音声レポート更新 ${ts}"`);
  git('push origin main');
  console.log('publish-audio: GitHub に公開しました。');
}

try {
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  generateMissingAudio();
  prune();
  const n = buildAudioPage();
  console.log(`audio.html: ${n} 件`);
  if (!NO_PUSH) publish();
  else console.log('publish-audio: --no-push のため git は触りません。');
} catch (e) {
  console.error('publish-audio: エラー ->', (e.stderr || e.stdout || e.message || '').toString().trim());
  process.exit(0); // セッションを止めない
}
