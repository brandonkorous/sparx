#!/usr/bin/env node
// Does every Postgres pool on the sparx server fit its 35 usable connections? (SI-1)
//
// Sums replicas x (DB_CONNECTION_LIMIT + AUTH_DB_CONNECTION_LIMIT) from k8s/azure/apps/db-budget.yaml,
// plus the operator console's pg pool. Fails when the direct total exceeds HARD_CAP or the load
// through PgBouncer exceeds BUDGET. A Deployment that uses the database with no entry fails too:
// an unset limit means the code's own default.
// Pure Node, no install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SERVER_POOL } from './pgbouncer-config.mjs';

// B1ms: 50 max_connections - 15 Azure-reserved = 35. Direct pools may use all 35 at their maximum;
// through PgBouncer 2 stay free for the role + migrate Jobs.
export const HARD_CAP = 35;
export const BUDGET = 33;
const DB_PACKAGES = ['@wizeworks/db', '@wizeworks/auth'];
const OPERATOR_PACKAGE = '@wizeworks/operator-auth';

// Pools on this server that no Deployment in this repo owns. The operator console moved to
// the wizeworks repo on 2026-10-27 and still signs operators in against wize_admin here, as
// wize_operator. Its pool size is OPERATOR_DB_POOL_MAX in that repo's k8s/admin/deployment.yaml;
// change both together.
export const OUTSIDE = [{ name: 'admin (wizeworks)', direct: 2 }];

/** Deployment name -> { db, auth, operator } from the multi-document budget patch file. */
export function parseBudget(text) {
  const out = {};
  for (const doc of text.split(/^---$/m)) {
    const name = /^ {2}name: (\S+)$/m.exec(doc)?.[1];
    if (!name) continue;
    const limit = (key) => Number(new RegExp(`name: ${key}, value: '(\\d+)'`).exec(doc)?.[1] ?? 0);
    out[name] = { db: limit('DB_CONNECTION_LIMIT'), auth: limit('AUTH_DB_CONNECTION_LIMIT'), operator: limit('OPERATOR_DB_POOL_MAX') };
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

/** Rows of { name, replicas, app, auth, direct } plus totals with and without PgBouncer, and problems. */
export function tally({ budget, replicas, kinds, operatorMax, codeFloors = {}, pooler = { pods: 0, max: 0 }, outside = [] }) {
  const rows = outside.map((o) => ({ name: o.name, replicas: 1, app: 0, auth: 0, direct: o.direct }));
  const problems = [];
  for (const [name, kind] of Object.entries(kinds)) {
    const count = replicas[name] ?? 1;
    if (kind === 'operator') rows.push({ name, replicas: count, app: 0, auth: 0, direct: budget[name]?.operator || operatorMax });
    else if (!budget[name]?.db) problems.push(`${name} uses the database but has no DB_CONNECTION_LIMIT in db-budget.yaml`);
    else {
      const app = Math.max(budget[name].db, codeFloors[name] ?? 0);
      if (app !== budget[name].db) problems.push(`${name}: code raises its pool to ${app}; db-budget.yaml must say ${app}`);
      rows.push({ name, replicas: count, app, auth: budget[name].auth, direct: app + budget[name].auth });
    }
  }
  for (const name of Object.keys(budget)) {
    if (!(name in kinds)) problems.push(`db-budget.yaml names ${name}, which is not a database-using Deployment`);
  }
  const sum = (f) => rows.reduce((s, r) => s + r.replicas * f(r), 0);
  const direct = sum((r) => r.direct);
  // Through PgBouncer every sparx_app pool shares its server pool; owner and operator pools stay direct.
  const pooled = pooler.pods * pooler.max + sum((r) => r.auth + (r.app === 0 ? r.direct : 0));
  if (direct > HARD_CAP) problems.push(`direct to Postgres the pools total ${direct}, over the ${HARD_CAP} usable connections`);
  if (pooled > BUDGET) problems.push(`with PgBouncer the server holds ${pooled}, over the budget of ${BUDGET}`);
  return { rows, direct, pooled, problems };
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
  // event-worker never opens fewer than this many connections, whatever its env says.
  const eventFloor = Number(/MIN_CONNECTION_LIMIT = (\d+)/.exec(read('wizeworks/services/event-worker/src/boot-db-pool.ts'))?.[1] ?? 0);
  const pooler = {
    pods: Number(/^ {2}replicas: (\d+)/m.exec(read('k8s/azure/infra/pgbouncer.yaml'))?.[1] ?? 0),
    max: SERVER_POOL.max,
  };
  const budget = parseBudget(read('k8s/azure/apps/db-budget.yaml'));
  return { budget, replicas, kinds, codeFloors: { 'event-worker': eventFloor }, pooler, outside: OUTSIDE };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { rows, direct, pooled, problems } = tally(readRepo(root));
  for (const r of rows) console.log(`  ${r.name.padEnd(18)} ${r.replicas} x ${r.direct} = ${r.replicas * r.direct}`);
  console.log(`  direct to Postgres: ${direct} of ${HARD_CAP}; through PgBouncer: ${pooled} of ${BUDGET}`);
  if (problems.length === 0) return console.log('check:db-budget — every pool fits, with or without PgBouncer.');
  for (const p of problems) console.error(`check:db-budget — ${p}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
