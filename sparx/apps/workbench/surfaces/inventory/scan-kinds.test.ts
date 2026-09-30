// THE CONSOLE'S COPY OF "WHAT A SCAN CAN BE" MUST MATCH THE SERVER'S.
//
// `ScanKind` here is a hand copy of `ALL_KINDS` in
// `wizeworks/packages/inventory/src/services/scan.ts`. It has to be a copy: the
// console reaches that code over HTTP and depends on no package that could hold
// the list, and adding a dependency on a server package to share nine strings
// would be the wrong trade.
//
// What it must not be is a copy nobody checks. `pick_list` was missing from
// three copies at once — this one, the REST route's `z.enum` and the MCP tool's
// — while two file headers and one printed sticker all said a walk sheet could
// be scanned. The other two copies are gone; this one is held here.
//
// It reads the other file's SOURCE. That is deliberate: importing it would make
// the console depend on the server package, which is the thing this test exists
// to avoid. [[feedback_structural_checks_go_blind]]

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Walk up to the workspace root rather than counting `..`s. */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = resolve(dir, '..');
    if (up === dir) break;
    dir = up;
  }
  throw new Error('workspace root not found above this test');
}

const SERVER = join(repoRoot(), 'wizeworks', 'packages', 'inventory', 'src', 'services', 'scan.ts');

/** The kinds `ALL_KINDS` lists, in order. */
function serverKinds(): string[] {
  const src = readFileSync(SERVER, 'utf8');
  const block = /export const ALL_KINDS: ScanKind\[\] = \[([\s\S]*?)\];/.exec(src);
  if (!block) throw new Error(`ALL_KINDS not found in ${SERVER} — has it moved or been renamed?`);
  return [...(block[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '');
}

/** The kinds this file's `ScanKind` union lists, in order. */
function consoleKinds(): string[] {
  const here = join(dirname(fileURLToPath(import.meta.url)), 'scan-data.ts');
  const src = readFileSync(here, 'utf8');
  const block = /export type ScanKind =([\s\S]*?);/.exec(src);
  if (!block) throw new Error('ScanKind union not found in scan-data.ts');
  return [...(block[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '');
}

/** Every key of `KIND_LABELS`, so a new kind cannot arrive without a word. */
function labelledKinds(): string[] {
  const here = join(dirname(fileURLToPath(import.meta.url)), 'scan-data.ts');
  const src = readFileSync(here, 'utf8');
  const block = /const KIND_LABELS: Record<ScanKind, string> = \{([\s\S]*?)\};/.exec(src);
  if (!block) throw new Error('KIND_LABELS not found in scan-data.ts');
  return [...(block[1] ?? '').matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1] ?? '');
}

describe('what a scan can be', () => {
  it('finds a real list on both sides', () => {
    expect(serverKinds().length).toBe(9);
    expect(consoleKinds().length).toBe(9);
  });

  it('matches the server, in the same order', () => {
    expect(consoleKinds()).toEqual(serverKinds());
  });

  it('gives every kind a word a person can read', () => {
    expect(labelledKinds().sort()).toEqual([...consoleKinds()].sort());
  });

  it('includes the walk sheet the label surface prints a barcode on', () => {
    expect(consoleKinds()).toContain('pick_list');
  });
});
