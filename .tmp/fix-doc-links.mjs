// One-shot: re-resolve relative markdown links across docs/** after moving 15
// docs into docs/archive/. Uniform rule: newRel = relative(newDir, newAbs(target)).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd().replace(/\\/g, '/');
const DOCS = `${ROOT}/docs`;

const MOVED = new Set([
  '31-email-section-composer.md',
  'cms-audit-2026-05-29.md',
  'crm-audit-2026-05-29.md',
  '24-domain-purchase-management.md',
  '27-customer-accounts-site-auth.md',
  '41-builder-page-model.md',
  '43-builder-binding-schema.md',
  '44-builder-site-render.md',
  '49-multi-site-per-tenant.md',
  '52-email-builder.md',
  '59-responsive-rendering.md',
  '62-responsive-site-chrome.md',
  '70-live-chat-module.md',
  '72-sparx-market-architecture.md',
  '93-one-tenant-email-system.md',
]);

// absolute posix path (repo-relative) of where a target lives AFTER the move
function newAbs(oldAbs) {
  // oldAbs like "docs/16-auth-security.md" or "packages/db/README.md"
  const m = oldAbs.match(/^docs\/([^/]+)$/);
  if (m && MOVED.has(m[1])) return `docs/archive/${m[1]}`;
  return oldAbs;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const linkRe = /(\]\()([^)]+)(\))/g;
let totalFiles = 0;
let totalLinks = 0;
const report = [];

for (const file of walk(DOCS)) {
  const rel = file.slice(ROOT.length + 1); // e.g. docs/archive/49-....md
  const base = path.posix.basename(file);
  // dir the file was authored in (pre-move): moved files came from docs/
  const inArchive = rel.startsWith('docs/archive/');
  const oldDir = inArchive && MOVED.has(base) ? 'docs' : path.posix.dirname(rel);
  const newDir = path.posix.dirname(rel);

  let changes = 0;
  const src = fs.readFileSync(file, 'utf8');
  const next = src.replace(linkRe, (whole, open, target, close) => {
    // skip urls, anchors-only, mailto, absolute
    if (/^(https?:|mailto:|#|\/)/.test(target)) return whole;
    const hashIdx = target.indexOf('#');
    const pathPart = hashIdx === -1 ? target : target.slice(0, hashIdx);
    const anchor = hashIdx === -1 ? '' : target.slice(hashIdx);
    if (!pathPart) return whole;
    // only touch links that point at files (have an extension or a slash);
    // leave bare words alone
    if (!/[./]/.test(pathPart)) return whole;
    const oldAbs = path.posix.normalize(path.posix.join(oldDir, pathPart));
    const tgtNewAbs = newAbs(oldAbs);
    let newRel = path.posix.relative(newDir, tgtNewAbs);
    if (!newRel.startsWith('.') && !newRel.includes('/')) {
      // same-dir sibling: keep as bare "foo.md" (markdown-friendly)
    }
    if (newRel !== pathPart) {
      changes++;
      return `${open}${newRel}${anchor}${close}`;
    }
    return whole;
  });

  if (changes > 0) {
    fs.writeFileSync(file, next);
    totalFiles++;
    totalLinks += changes;
    report.push(`${changes.toString().padStart(3)}  ${rel}`);
  }
}

report.sort();
console.log(report.join('\n'));
console.log(`\n--- ${totalLinks} links rewritten across ${totalFiles} files ---`);
