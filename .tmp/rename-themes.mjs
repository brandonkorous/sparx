// One-off: rename @sparx/storefront-themes → @sparx/site-themes across tracked
// files. Exact-string replace only (package id + dir path); preserves bytes /
// line endings (Node writes the string verbatim, no autocrlf). Run AFTER the
// `git mv packages/storefront-themes packages/site-themes`.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => !f.startsWith('pnpm-lock') && !f.startsWith('.tmp/'));

const REPLACEMENTS = [
  ['@sparx/storefront-themes', '@sparx/site-themes'],
  ['packages/storefront-themes', 'packages/site-themes'],
];

const changed = [];
for (const f of files) {
  let c;
  try {
    c = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let n = c;
  for (const [from, to] of REPLACEMENTS) n = n.split(from).join(to);
  if (n !== c) {
    writeFileSync(f, n);
    changed.push(f);
  }
}
console.log(changed.join('\n'));
console.log('TOTAL FILES CHANGED:', changed.length);
