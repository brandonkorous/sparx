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
 * That holds only while nothing in the app imports them again, directly or
 * through a library. One `import { auth } from '@wizeworks/auth'` in a route
 * handler builds a Better Auth server on first use; one
 * `import { capacityReport } from '@wizeworks/usage'` opens a Prisma client.
 * Both build, pass every test, and fail only in production, where the pod no
 * longer has the secret they need. So this check reads every source file of
 * each app below and refuses:
 *
 *   1. An import of a workspace package that itself depends on `@wizeworks/db`
 *      or `@prisma/client` (that includes `@wizeworks/db` itself and
 *      `@wizeworks/auth`), unless the import names one of the PURE entry
 *      points listed below: a file in such a package that imports nothing of
 *      the database or the server. The list is short on purpose; adding to it
 *      means reading the entry point's imports first.
 *   2. An import of `@prisma/client`, or of the server parts of `better-auth`
 *      (its root, `/cookies`, `/crypto`, `/next-js`, `/adapters/*`).
 *   3. A direct dependency on `@wizeworks/db` or `@prisma/client` in the app's
 *      package.json.
 *
 * A whole-statement `import type` / `export type` is allowed from anywhere: the
 * compiler erases it, so it cannot open a connection. A mixed import
 * (`import { type A, b }`) is still read as a value import, because it is one.
 *
 * ---------------------------------------------------------------------------
 * The list of apps
 * ---------------------------------------------------------------------------
 *
 * Apps join it as they switch (docs/154 "Rollout"). When every app is on it,
 * the list is the whole of `*\/apps/*`.
 *
 * A listed app with no source files fails, and so does a package map in which
 * `@wizeworks/auth` does not read as reaching the database: a check that scans
 * nothing prints the same "ok" as one that found nothing, which is how a
 * renamed directory turns a guard off without anybody noticing.
 *
 * Pure Node, no dependencies. Runs in CI and in the pre-push guard.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** Apps that reach data only through api-rest. */
const OFF_THE_DATABASE = ['piggles/apps/workbench', 'piggles/apps/account'];

/** Entry points of database-using packages that import neither the database
 *  nor the auth server. */
const PURE_ENTRIES = new Set([
  '@wizeworks/auth/client',
  '@wizeworks/auth/org-roles',
  '@wizeworks/auth/module-access',
  '@wizeworks/auth/property-access',
  '@wizeworks/auth/friendly-slug',
  '@wizeworks/auth/mcp-scopes',
  '@wizeworks/email-sequences/schemas',
  '@wizeworks/social/cadence',
]);

const PACKAGE_ROOTS = ['wizeworks/packages', 'sparx/packages', 'piggles/packages'];
const DATABASE_PACKAGES = ['@wizeworks/db', '@prisma/client'];

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', 'public']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function isAuthServer(specifier) {
  return (
    specifier === 'better-auth' ||
    specifier === 'better-auth/cookies' ||
    specifier === 'better-auth/crypto' ||
    specifier === 'better-auth/next-js' ||
    specifier.startsWith('better-auth/adapters')
  );
}

/** Workspace package names whose own package.json depends on the database. */
function databasePackages() {
  const found = new Set(['@wizeworks/db']);
  for (const root of PACKAGE_ROOTS) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name, 'package.json');
      if (!entry.isDirectory() || !fs.existsSync(file)) continue;
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
      if (DATABASE_PACKAGES.some((name) => name in deps)) found.add(pkg.name);
    }
  }
  return found;
}

/** `@scope/name/sub/path` → `@scope/name`; `name/sub` → `name`. */
function packageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Every module specifier in a source file: static and dynamic imports,
 *  re-exports, and require(). Comments are stripped first, so a sentence that
 *  names a package is not an import of it, and so are type-only statements,
 *  which the compiler erases. */
function importsIn(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/\b(?:import|export)\s+type\s[^;'"`]*?\bfrom\s*['"][^'"]+['"]/g, '');
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
  const reachesDatabase = databasePackages();
  if (!reachesDatabase.has('@wizeworks/auth')) {
    problems.push(
      'the package map did not find @wizeworks/auth reaching the database, so it is reading the wrong place'
    );
  }

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
      const where = path.relative(ROOT, file).replaceAll('\\', '/');
      for (const specifier of importsIn(fs.readFileSync(file, 'utf8'))) {
        if (specifier === '@prisma/client' || specifier.startsWith('@prisma/client/')) {
          problems.push(`${where}: imports '${specifier}', the database`);
        } else if (isAuthServer(specifier)) {
          problems.push(`${where}: imports '${specifier}', the auth server`);
        } else if (reachesDatabase.has(packageOf(specifier)) && !PURE_ENTRIES.has(specifier)) {
          problems.push(
            `${where}: imports '${specifier}', and ${packageOf(specifier)} reaches the database`
          );
        }
      }
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of DATABASE_PACKAGES) {
      if (name in deps) problems.push(`${app}/package.json: depends on ${name}`);
    }
  }

  if (problems.length > 0) {
    console.error(
      'An app that reaches data only through api-rest reaches the database or the auth server:\n'
    );
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      '\nCall api-rest instead (@wizeworks/auth-client-server, or an api-rest endpoint), or import' +
        ' a pure entry point (docs/154).'
    );
    process.exit(1);
  }
  console.log(
    `check-app-data-access: ${OFF_THE_DATABASE.length} app(s), ${scanned} source files, nothing reaches the database or the auth server.`
  );
}

main();
