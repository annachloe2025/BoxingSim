// 一覧ページを作り直し、変更があれば GitHub へ commit & push する。
// 自動公開フック（.claude/settings.local.json）から呼ばれる。手動実行も可: node tools/publish.js
const { execSync } = require('child_process');
const path = require('path');
const { buildIndex } = require('./build-index.js');

const ROOT = path.join(__dirname, '..');

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  buildIndex();
  git('add -A');

  const status = git('status --porcelain').trim();
  if (!status) {
    console.log('publish: 変更なし。何もしません。');
    process.exit(0);
  }

  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  git(`commit -m "auto: サイト更新 ${ts}"`);
  git('push origin main');
  console.log('publish: GitHub に公開しました。');
} catch (e) {
  // 公開失敗でセッションを止めないよう、エラーは表示するだけ
  const msg = (e.stderr || e.stdout || e.message || '').toString().trim();
  console.error('publish: 公開に失敗しました ->', msg);
  process.exit(0);
}
