#!/usr/bin/env node
/**
 * Every service declares the environment it cannot start without.
 *
 * ─── THE FAILURE THIS EXISTS FOR ────────────────────────────────────────────
 *
 * `wizeworks/services/event-worker` — the process running all fourteen event
 * handlers — had neither a `.env` nor a `.env.example`. It has a `dev` script,
 * so `turbo run dev` started it on every `pnpm dev`; it read its environment,
 * found no DATABASE_URL, printed four lines and exited 78 into one pane of a
 * thirty-pane TUI. It had never run locally. Not once.
 *
 * Nothing caught it, and nothing COULD have: typecheck, lint and 1400 tests all
 * pass on a service that cannot boot, because none of them boot it. The absence
 * of a file is not a compile error. It is the shape of defect the "absent
 * behaves like fine" rule names — a missing thing renders identically to a
 * correct one, right up until somebody asks why the search index is empty.
 *
 * ─── WHAT IS CHECKED ────────────────────────────────────────────────────────
 *
 * Two claims, both structural:
 *
 *   1. A service directory has a `.env.example`. That file is the answer to
 *      "what do I need to run this", and it is the only such answer that is
 *      committed — a `.env` is gitignored, so a machine that works proves
 *      nothing about a machine that does not.
 *
 *   2. Every key its env schema marks REQUIRED appears in that `.env.example`.
 *      A required key added six months after the example was written is the
 *      same defect with a longer fuse. "Required" means a zod field with
 *      neither `.optional()` nor `.default(...)`.
 *
 *   3. No two services declare the same PORT. This one was added an hour after
 *      the first two, because writing event-worker's `.env` fixed the missing
 *      file and put it on 8080 -- which cache-revalidation-worker already had.
 *      The loser dies of EADDRINUSE, in the same pane nobody was reading, and
 *      the failure looks identical from the outside: fourteen handlers not
 *      consuming while the broker quietly fills up. A collision is trivial to
 *      see from above and nearly invisible from inside one service, which is
 *      the definition of something a structural check should own.
 *
 * Only `wizeworks/services/*` is scanned: an app under `sparx/` or `piggles/`
 * is a Next.js process whose env is `NEXT_PUBLIC_*` conventions and a different
 * problem. If that changes, add the root here — and the assertion below will
 * tell you loudly if the path ever stops resolving.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file, never by counting '..' from a cwd. Five sibling
// checks went blind in one tree move by doing the latter.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCAN_ROOTS = ['wizeworks/services'];

/** Services with no environment of their own to declare. Each is a decision. */
const NO_ENV = new Set([]);

/** A zod field line: `  DATABASE_URL: z.string().min(1),` */
const FIELD = /^\s{2}([A-Z][A-Z0-9_]{2,}):\s*(z\..*)$/gm;

/** Where a service keeps its schema. Checked in order; the first that exists wins. */
const SCHEMA_FILES = ['src/env.ts', 'src/lib/env.ts', 'src/config.ts'];

function requiredKeys(dir) {
  const file = SCHEMA_FILES.map((f) => join(dir, f)).find((f) => existsSync(f));
  if (!file) return null;
  const src = readFileSync(file, 'utf8');
  const keys = [];
  for (const m of src.matchAll(FIELD)) {
    const [, key, rest] = m;
    // A field continued onto the next line may carry its .default() there, so
    // read to the end of the declaration rather than the end of the line.
    const from = src.indexOf(m[0]);
    const decl = src.slice(from, from + 400);
    const end = decl.search(/\n\s{2}[A-Z][A-Z0-9_]*:|\n\}\)/);
    const body = end === -1 ? rest : decl.slice(0, end);
    if (/\.optional\(\)|\.default\(|\.nullish\(\)/.test(body)) continue;
    keys.push(key);
  }
  return { file: relative(ROOT, file).split(sep).join('/'), keys };
}

const problems = [];
/** port -> the services claiming it. */
const ports = new Map();
let services = 0;

/** The port a service will actually bind: its `.env.example` wins, its schema
 *  default answers when the example is silent. Null when it has no listener. */
function declaredPort(dir, exampleSrc) {
  const fromExample = /^\s*PORT\s*=\s*"?(\d+)"?/m.exec(exampleSrc)?.[1];
  if (fromExample) return Number(fromExample);
  const file = SCHEMA_FILES.map((f) => join(dir, f)).find((f) => existsSync(f));
  if (!file) return null;
  const decl = /PORT:[^;]{0,200}?\.default\((\d+)\)/.exec(readFileSync(file, 'utf8'));
  return decl ? Number(decl[1]) : null;
}

for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root);
  if (!existsSync(abs)) {
    console.error('\nService env check FAILED: scan root is missing: ' + root);
    console.error('  A moved or renamed tree makes this check blind. Fix the path.\n');
    process.exit(1);
  }
  for (const name of readdirSync(abs)) {
    const dir = join(abs, name);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(join(dir, 'package.json'))) continue;
    if (NO_ENV.has(name)) continue;
    services += 1;

    const example = join(dir, '.env.example');
    if (!existsSync(example)) {
      problems.push({
        service: name,
        detail:
          'has no .env.example. `pnpm dev` starts this service; without a committed ' +
          'answer to "what does it need", it exits on a fresh checkout and the exit ' +
          'is one pane in a thirty-pane TUI.',
      });
      continue;
    }

    const exampleSrc = readFileSync(example, 'utf8');
    const port = declaredPort(dir, exampleSrc);
    if (port !== null) {
      if (!ports.has(port)) ports.set(port, []);
      ports.get(port).push(name);
    }

    const required = requiredKeys(dir);
    if (!required) continue;
    const declared = new Set(
      exampleSrc
        .split('\n')
        .map((l) => /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(l.trim())?.[1])
        .filter(Boolean)
    );
    const missing = required.keys.filter((k) => !declared.has(k));
    if (missing.length > 0) {
      problems.push({
        service: name,
        detail:
          required.file +
          ' requires ' +
          missing.join(', ') +
          ' — absent from .env.example, so the service exits 78 on a fresh checkout.',
      });
    }
  }
}

// The denominator, always: a count with no total hides a check that has stopped
// looking at anything.
for (const [port, claimants] of ports) {
  if (claimants.length < 2) continue;
  problems.push({
    service: claimants.join(' + '),
    detail:
      'both bind port ' +
      port +
      '. One of them wins and the other dies of EADDRINUSE on startup -- silently, ' +
      'in one pane of a thirty-pane TUI. Give one a free port in its .env.example.',
  });
}

console.log(
  'Service env check: ' + services + ' service(s) scanned, ' + ports.size + ' distinct port(s).'
);

if (problems.length > 0) {
  console.error('\nService env check FAILED: ' + problems.length + ' service(s).\n');
  for (const p of problems) console.error('  ' + p.service + '\n    ' + p.detail + '\n');
  console.error('  A service that cannot start is not caught by typecheck, lint or tests —');
  console.error('  none of them boot it. The committed .env.example is the only guard.\n');
  process.exit(1);
}
console.log('OK: every service declares the environment it needs.');
