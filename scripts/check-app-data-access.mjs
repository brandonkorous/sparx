#!/usr/bin/env node
/**
 * Does an app that has moved off the database stay off it?
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * An app reaches the database and the sign-in server only through api-rest
 * (docs/154). It holds no database connection, no auth secret, and no Better
 * Auth instance, so its pod can run without `sparx-app-secrets` at all.
 *
 * That holds only while nothing in the app imports them again. One
 * `import { auth } from '@wizeworks/auth'` in a route handler builds a Better
 * Auth server on first use, and it fails only in production, where the pod no
 * longer has the secret it needs. So this check reads every source file of each
 * app below and refuses an import of:
 *
 *   - `@wizeworks/db` and `@prisma/client` (the database);
 *   - `@wizeworks/auth` itself and `@wizeworks/auth/server` (the auth server).
 *     Its pure entry points (`/client`, `/org-roles`, `/module-access`,
 *     `/property-access`, `/friendly-slug`) stay allowed: they build nothing;
 *   - the server parts of `better-auth` (its root, `/cookies`, `/crypto`,
 *     `/next-js`, `/adapters/*`).
 *
 * and a direct dependency on `@wizeworks/db` or `@prisma/client` in the app's
 * package.json.
 *
 * ---------------------------------------------------------------------------
 * The list
 * ---------------------------------------------------------------------------
 *
 * Apps join it as they switch (docs/154 "Rollout"). When every app is on it,
 * the list is the whole of `*\/apps/*`.
 *
 * A listed app with no source files fails: a check that scans nothing prints
 * the same "ok" as one that found nothing, which is how a renamed directory
 * turns a guard off without anybody noticing.
 *
 * Pure Node, no dependencies. Runs in CI and in the pre-push guard.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** Apps that reach data only through api-rest. */
const OFF_THE_DATABASE = ['piggles/apps/workbench'];

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', 'public']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Module specifiers an off-the-database app may not import. */
const BANNED = [
  { test: (s) => s === '@wizeworks/db' || s.startsWith('@wizeworks/db/'), why: 'the database' },
  { test: (s) => s === '@prisma/client' || s.startsWith('@prisma/client/'), why: 'the database' },
  {
    test: (s) => s === '@wizeworks/auth' || s === '@wizeworks/auth/server',
    why: 'the auth server (use @wizeworks/auth-client-server, or a pure @wizeworks/auth/<entry>)',
  },
  {
    test: (s) =>
      s === 'better-auth' ||
      s === 'better-auth/cookies' ||
      s === 'better-auth/crypto' ||
      s === 'better-auth/next-js' ||
      s.startsWith('better-auth/adapters'),
    why: 'the auth server',
  },
];

const BANNED_DEPENDENCIES = ['@wizeworks/db', '@prisma/client'];

/** Every module specifier in a source file: static and dynamic imports,
 *  re-exports, and require(). Comments are stripped first, so a sentence that
 *  names a package is not an import of it. */
function importsIn(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const found = [];
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(path.join(dir, entry.name)));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function main() {
  const problems = [];
  let scanned = 0;

  for (const app of OFF_THE_DATABASE) {
    const dir = path.join(ROOT, app);
    if (!fs.existsSync(dir)) {
      problems.push(`${app}: listed, but the directory does not exist`);
      continue;
    }
    const files = sourceFiles(dir);
    if (files.length === 0) {
      problems.push(`${app}: listed, but no source files were found under it`);
      continue;
    }
    scanned += files.length;

    for (const file of files) {
      for (const specifier of importsIn(fs.readFileSync(file, 'utf8'))) {
        const rule = BANNED.find((r) => r.test(specifier));
        if (rule) {
          problems.push(
            `${path.relative(ROOT, file).replaceAll('\\', '/')}: imports '${specifier}', ${rule.why}`
          );
        }
      }
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of BANNED_DEPENDENCIES) {
      if (name in deps) problems.push(`${app}/package.json: depends on ${name}`);
    }
  }

  if (problems.length > 0) {
    console.error(
      'An app that reaches data only through api-rest imports the database or the auth server:\n'
    );
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nCall api-rest through @wizeworks/auth-client-server instead (docs/154).');
    process.exit(1);
  }
  console.log(
    `check-app-data-access: ${OFF_THE_DATABASE.length} app(s), ${scanned} source files, no database or auth-server import.`
  );
}

main();
