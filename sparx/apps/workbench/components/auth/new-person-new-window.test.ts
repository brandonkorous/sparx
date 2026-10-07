// A change of person or of business loads the window fresh.
//
// The root layout asks for a pass on every page, auth pages included, and the
// window keeps it until it reloads. MEASURED 2026-10-06: Kendra Ruiz pressed
// "Accept & enter Gillett" and was moved with `router.replace('/')`; the window
// still held the pass for her own empty workspace, so she was asked to set up a
// salon. The same soft move after "Switch account" and sign-in would have carried
// the previous person's pass into the next person's workbench (persona issue 124).
//
// A source check, since the console keeps no render tests: these files may not
// move softly.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FILES = ['components/auth/auth-wrapper.tsx', 'app/accept-invite/accept-invite-client.tsx'];

describe('signing in, switching account and joining a business', () => {
  it.each(FILES)('%s loads the window instead of moving softly', (file) => {
    const source = readFileSync(join(APP, file), 'utf8');
    expect(source).not.toMatch(/router\.(replace|push)\(/);
    expect(source).toMatch(/window\.location\.assign\(/);
  });
});
