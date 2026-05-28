// reports/ をスキャンして、スマホで見やすいトップページ index.html を生成する。
// 自動公開（tools/publish.js）から呼ばれるほか、単体実行もできる: node tools/build-index.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

function extractTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    || html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  return m ? m[1].trim() : fallback;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildIndex() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.toLowerCase().endsWith('.html'));

  const items = files.map(f => {
    const html = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8');
    const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
    return {
      file: f,
      title: extractTitle(html, f.replace(/\.html$/i, '')),
      date: dateMatch ? dateMatch[1] : '',
    };
  });

  // 日付の新しい順、同日はファイル名の降順
  items.sort((a, b) => (b.date.localeCompare(a.date)) || b.file.localeCompare(a.file));

  const rows = items.map(it => `      <li>
        <a href="reports/${esc(it.file)}">
          <span class="date">${esc(it.date)}</span>
          <span class="title">${esc(it.title)}</span>
        </a>
      </li>`).join('\n');

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const out = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BoxingSim レポート一覧</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
         line-height: 1.5; background: #0f1115; color: #e6e8eb; }
  header { padding: 20px 16px 8px; }
  h1 { font-size: 1.3rem; margin: 0 0 4px; }
  .sub { color: #9aa0a6; font-size: .8rem; }
  ul { list-style: none; margin: 8px 0 0; padding: 0; }
  li a { display: block; padding: 14px 16px; border-top: 1px solid #23262d;
         text-decoration: none; color: inherit; }
  li a:active { background: #1a1d23; }
  .date { display: block; font-size: .72rem; color: #8ab4f8; letter-spacing: .04em; }
  .title { display: block; font-size: 1rem; margin-top: 2px; }
  footer { padding: 24px 16px; color: #9aa0a6; font-size: .78rem; }
  footer a { color: #8ab4f8; }
</style>
</head>
<body>
  <header>
    <h1>BoxingSim レポート一覧</h1>
    <div class="sub">${items.length} 件 ・ 更新: ${now} ・ 新しい順</div>
  </header>
  <main>
    <ul>
${rows}
    </ul>
  </main>
  <footer>
    <a href="README.html">README</a> ・
    <a href="src/index.html">シミュレーター本体</a>
  </footer>
</body>
</html>
`;

  fs.writeFileSync(path.join(ROOT, 'index.html'), out, 'utf8');
  return items.length;
}

if (require.main === module) {
  const n = buildIndex();
  console.log(`build-index: index.html を生成しました（レポート ${n} 件）`);
}

module.exports = { buildIndex };
