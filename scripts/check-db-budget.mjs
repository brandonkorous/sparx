#!/usr/bin/env node
// Does every Postgres pool on the sparx server fit its 35 usable connections? (SI-1)
//
// Sums replicas x (DB_CONNECTION_LIMIT + AUTH_DB_CONNECTION_LIMIT) from k8s/azure/apps/db-budget.yaml,
// plus the operator console's pg pool, and fails above BUDGET. A Deployment whose package uses the
// database but has no entry also fails: an unset limit means Prisma's own, uncapped default.
// Pure Node, no install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// B1ms: 50 max_connections - 15 Azure-reserved = 35; 2 kept for the role + migrate Jobs.
export const BUDGET = 33;
const DB_PACKAGES = ['@wizeworks/db', '@wizeworks/auth'];
const OPERATOR_PACKAGE = '@wizeworks/operator-auth';

/** Deployment name -> { db, auth } from the multi-document budget patch file. */
export function parseBudget(text) {
  const out = {};
  for (const doc of text.split(/^---$/m)) {
    const name = /^ {2}name: (\S+)$/m.exec(doc)?.[1];
    if (!name) continue;
    const limit = (key) => Number(new RegExp(`name: ${key}, value: '(\\d+)'`).exec(doc)?.[1] ?? 0);
    out[name] = { db: limit('DB_CONNECTION_LIMIT'), auth: limit('AUTH_DB_CONNECTION_LIMIT') };
  }
  return out;
}

/** Deployment name -> count from a kustomization's `replicas:` block. */
export function parseReplicaOverrides(text) {
  const block = /^replicas:\n((?:[ #].*\n|\n)*)/m.exec(text)?.[1] ?? '';
  const out = {};
  for (const m of block.matchAll(/- name: (\S+)\n\s+count: (\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

/** Deployment name -> replicas declared in base manifests. */
export function parseBaseReplicas(texts) {
  const out = {};
  for (const doc of texts.join('\n---\n').split(/^---$/m)) {
    if (!/^kind: Deployment$/m.test(doc)) continue;
    const name = /^ {2}name: (\S+)$/m.exec(doc)?.[1];
    const replicas = /^ {2}replicas: (\d+)/m.exec(doc)?.[1];
    if (name) out[name] = Number(replicas ?? 1);
  }
  return out;
}

/** Image name -> its source directory, from the release build matrix. */
export function parseMatrix(text) {
  const out = {};
  for (const m of text.matchAll(/name:\s*([\w-]+),\s*dockerfile:\s*([\w./-]+)\/Dockerfile/g)) out[m[1]] = m[2];
  return out;
}

/** Which pools a package.json opens: 'db' (Prisma), 'operator' (pg pool) or null. */
export function poolKind(pkgText) {
  const deps = JSON.parse(pkgText).dependencies ?? {};
  if (DB_PACKAGES.some((p) => p in deps)) return 'db';
  return OPERATOR_PACKAGE in deps ? 'operator' : null;
}

/** Rows of { name, replicas, perPod } and the problems found. */
export function tally({ budget, replicas, kinds, operatorMax }) {
  const rows = [];
  const problems = [];
  for (const [name, kind] of Object.entries(kinds)) {
    const count = replicas[name] ?? 1;
    if (kind === 'operator') rows.push({ name, replicas: count, perPod: operatorMax });
    else if (!budget[name]?.db) problems.push(`${name} uses the database but has no DB_CONNECTION_LIMIT in db-budget.yaml`);
    else rows.push({ name, replicas: count, perPod: budget[name].db + budget[name].auth });
  }
  for (const name of Object.keys(budget)) {
    if (!(name in kinds)) problems.push(`db-budget.yaml names ${name}, which is not a database-using Deployment`);
  }
  const total = rows.reduce((sum, r) => sum + r.replicas * r.perPod, 0);
  if (total > BUDGET) problems.push(`pools total ${total}, over the budget of ${BUDGET}`);
  return { rows, total, problems };
}

function readRepo(root) {
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const manifests = [...fs.readdirSync(path.join(root, 'k8s/apps')).map((f) => `k8s/apps/${f}`), 'k8s/self-hosted/workers.yaml'];
  const baseReplicas = parseBaseReplicas(manifests.filter((p) => p.endsWith('.yaml')).map(read));
  const replicas = { ...baseReplicas, ...parseReplicaOverrides(read('k8s/azure/apps/kustomization.yaml')) };
  const kinds = {};
  for (const [name, dir] of Object.entries(parseMatrix(read('.github/workflows/release.yml')))) {
    const kind = name in baseReplicas ? poolKind(read(`${dir}/package.json`)) : null;
    if (kind) kinds[name] = kind;
  }
  const operatorMax = Number(/max: (\d+)/.exec(read('wizeworks/packages/operator-auth/src/db.ts'))?.[1]);
  return { budget: parseBudget(read('k8s/azure/apps/db-budget.yaml')), replicas, kinds, operatorMax };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { rows, total, problems } = tally(readRepo(root));
  for (const r of rows) console.log(`  ${r.name.padEnd(18)} ${r.replicas} x ${r.perPod} = ${r.replicas * r.perPod}`);
  console.log(`  total ${total} of ${BUDGET}`);
  if (problems.length === 0) return console.log('check:db-budget — every pool fits.');
  for (const p of problems) console.error(`check:db-budget — ${p}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
