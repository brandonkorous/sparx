// A SERVER page never hands a component to a client one.
//
// MEASURED 2026-10-06: /accept-invite (a server component) gave AuthShell a tab
// whose `icon` was the lucide `UserPlus` component. React refuses to send an
// object with a render method across that line, and the page fell over with "The
// workbench hit a problem" for every person ever invited: nobody could join a
// team (sparx persona issue 121). The icon now lives in a client wrapper.
//
// This reads every file under app/ that is not a client component and refuses
// `icon: SomeComponent`. It fails loudly if it finds nothing to read.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = dirname(fileURLToPath(import.meta.url));

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('server pages', () => {
  it('pass no icon component to a client component', () => {
    const files = tsxFiles(APP);
    const server = files.filter(
      (file) => !/^\s*['"]use client['"]/m.test(readFileSync(file, 'utf8').slice(0, 400))
    );
    // A scan that reads nothing reports green over the next bug.
    expect(server.length).toBeGreaterThan(5);
    const offenders = server.filter((file) =>
      /\bicon:\s*[A-Z][A-Za-z0-9]*\s*[,}]/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders.map((file) => relative(APP, file))).toEqual([]);
  });
});
