const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

const files = ['index.js', ...walk('src'), ...walk('scripts')];
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
