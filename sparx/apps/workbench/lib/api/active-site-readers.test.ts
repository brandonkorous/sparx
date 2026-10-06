// sparx persona issue 028: a screen that reads the raw active-site cookie is DEAD for
// every business that never opened the site switcher (no cookie means the primary
// site). Site identity sat on "Loading…" forever; the email editor, the site designer
// and three product screens had the same read. `useActivePropertyId` answers the
// primary; only the shell, which keys layouts on the raw value on purpose, may read it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = join(__dirname, '..', '..');
const ALLOWED = new Set(['components/workbench-shell.tsx', 'lib/api/shell-data.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the active site', () => {
  it('is read through useActivePropertyId everywhere but the shell', () => {
    const files = ['surfaces', 'components', 'lib'].flatMap((root) => walk(join(app, root)));
    expect(files.length).toBeGreaterThan(100);
    const raw = files
      .map((file) => relative(app, file).split(sep).join('/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => readFileSync(join(app, file), 'utf8').includes('useActiveSiteId()'));
    expect(raw).toEqual([]);
  });
});
