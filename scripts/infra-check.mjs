#!/usr/bin/env node
// Run one of wize-infrastructure's cross-repository checks against THIS tree.
//
//   node scripts/infra-check.mjs check-event-topics       (pnpm check:events)
//   node scripts/infra-check.mjs check-cloudflare-ranges  (pnpm check:cloudflare-ranges)
//
// ─── WHY THE CHECK IS NOT HERE ──────────────────────────────────────────────
//
// On 2026-10-29 the Terraform and the Caddy ingress moved out of this repository
// into wizeworksllc/wize-infrastructure, because they serve every product on the
// cluster and a change to one product's route waited two hours behind a sparx
// release. Two checks compare something HERE with something THERE: every event in
// the catalog has a Pub/Sub topic in its Terraform, and the Cloudflare ranges in
// wizeworks/packages/client-ip match the ones Caddy trusts. Each lives with the
// half it is easier to break from, and reads the other half by path (`--sparx`).
//
// So adding an event is still caught on the pull request that adds it: CI checks
// wize-infrastructure out beside this tree (ci.yml, `event-topics`), and locally
// this script finds a checkout of it on disk.
//
// ─── WHERE IT LOOKS ──────────────────────────────────────────────────────────
//
//   1. $WIZE_INFRASTRUCTURE_DIR, when set.
//   2. `wize-infrastructure` beside this checkout.
//   3. `wize-infrastructure` beside the MAIN checkout, for a git worktree that
//      lives somewhere else entirely (git's common dir names the main one).
//
// Not found is exit 2 with the places it looked, never a pass: a check that
// cannot see what it checks has to say so.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS = new Set(['check-event-topics', 'check-cloudflare-ranges']);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
if (!CHECKS.has(name)) {
  console.error(`usage: node scripts/infra-check.mjs <${[...CHECKS].join('|')}>`);
  process.exit(2);
}

function mainCheckout() {
  try {
    const common = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        cwd: root,
        encoding: 'utf8',
      }
    ).trim();
    return path.dirname(common);
  } catch {
    return null;
  }
}

const candidates = [
  process.env.WIZE_INFRASTRUCTURE_DIR,
  path.join(root, '..', 'wize-infrastructure'),
  mainCheckout() && path.join(mainCheckout(), '..', 'wize-infrastructure'),
].filter(Boolean);

const infra = candidates.find((dir) => existsSync(path.join(dir, 'scripts', `${name}.mjs`)));
if (!infra) {
  console.error(
    `${name}: no wize-infrastructure checkout found. Looked in:\n` +
      candidates.map((dir) => `  ${path.resolve(dir)}`).join('\n') +
      '\nClone wizeworksllc/wize-infrastructure beside this repository, or set WIZE_INFRASTRUCTURE_DIR.'
  );
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [path.join(infra, 'scripts', `${name}.mjs`), '--sparx', root],
  {
    stdio: 'inherit',
  }
);
process.exit(result.status ?? 1);
