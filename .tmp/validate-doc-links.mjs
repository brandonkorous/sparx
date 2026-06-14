import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd().replace(/\\/g, '/');
function walk(d) {
  const o = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.posix.join(d, e.name);
    if (e.isDirectory()) o.push(...walk(p));
    else if (e.name.endsWith('.md')) o.push(p);
  }
  return o;
}
const re = /\]\(([^)]+)\)/g;
const broken = [];
for (const f of walk(ROOT + '/docs')) {
  const dir = path.posix.dirname(f);
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    let t = m[1];
    if (/^(https?:|mailto:|#|\/)/.test(t)) continue;
    t = t.split('#')[0];
    if (!t || !/[./]/.test(t)) continue;
    if (!t.endsWith('.md')) continue;
    const abs = path.posix.normalize(path.posix.join(dir, t));
    if (!fs.existsSync(abs)) broken.push(f.slice(ROOT.length + 1) + '  ->  ' + t);
  }
}
if (broken.length === 0) console.log('ALL .md LINKS RESOLVE');
else {
  console.log('UNRESOLVED (' + broken.length + '):');
  console.log(broken.join('\n'));
}
