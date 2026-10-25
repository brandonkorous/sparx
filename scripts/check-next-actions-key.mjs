#!/usr/bin/env node
// Is every Next app built and run with one stable server-action key, and does every image carry its release? (SI-2)
//
// Next salts server-action ids with NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, random per build when unset, so every
// release broke open tabs ("Failed to find Server Action"). For each Next image in the release matrix this
// checks the four places that must agree: the matrix names a NEXT_ACTIONS_KEY_* secret, the build passes it,
// the Dockerfile mounts it, the pod maps it, and the secret sync copies it. Pure Node, no install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** { name, dockerfile, actionsKey } for every entry of the release build matrix. */
export function parseMatrixEntries(releaseText) {
  const out = [];
  for (const m of releaseText.matchAll(/-\s*\{([^}]*dockerfile:[^}]*)\}/g)) {
    const field = (k) => new RegExp(`${k}:\\s*([\\w./-]+)`).exec(m[1])?.[1];
    out.push({ name: field('name'), dockerfile: field('dockerfile'), actionsKey: field('actions_key') });
  }
  return out;
}

/** Problems for one Next image; `files` holds the Dockerfile, its k8s manifest and release.yml. */
export function nextProblems(entry, { dockerfile, manifest, release }) {
  const key = entry.actionsKey;
  if (!key) return [`${entry.name}: no actions_key in the release matrix`];
  const problems = [];
  if (!release.includes('next_actions_key=${{ matrix.actions_key && secrets[matrix.actions_key]')) {
    problems.push(`${entry.name}: the build step does not pass next_actions_key`);
  }
  if (!/id=next_actions_key/.test(dockerfile) || !dockerfile.includes('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY')) {
    problems.push(`${entry.name}: ${entry.dockerfile} does not build with the next_actions_key secret`);
  }
  const mapped = new RegExp(`name: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY[\\s\\S]{0,200}?key: ${key}\\s`).test(manifest ?? '');
  if (!mapped) problems.push(`${entry.name}: k8s/apps/${entry.name}.yaml does not map ${key}`);
  if (!release.includes(`${key}: \${{ secrets.${key} }}`)) problems.push(`${entry.name}: the secret sync does not read ${key}`);
  return problems;
}

/** Problems for any image: it must bake the commit as WIZELENS_RELEASE. */
export function releaseProblems(entry, dockerfile, release) {
  const problems = [];
  if (!/^ARG WIZELENS_RELEASE/m.test(dockerfile)) problems.push(`${entry.name}: ${entry.dockerfile} has no ARG WIZELENS_RELEASE`);
  if (!release.includes('WIZELENS_RELEASE=${{ github.sha }}')) problems.push('release.yml does not pass WIZELENS_RELEASE');
  return problems;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => (fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8') : undefined);
  const release = read('.github/workflows/release.yml');
  const problems = new Set();
  for (const entry of parseMatrixEntries(release)) {
    const dockerfile = read(entry.dockerfile) ?? '';
    for (const p of releaseProblems(entry, dockerfile, release)) problems.add(p);
    if (!dockerfile.includes('.next/standalone')) continue;
    const manifest = read(`k8s/apps/${entry.name}.yaml`);
    for (const p of nextProblems(entry, { dockerfile, manifest, release })) problems.add(p);
  }
  if (problems.size === 0) return console.log('check:next-actions-key — every Next app keeps its action ids.');
  for (const p of problems) console.error(`check:next-actions-key — ${p}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
