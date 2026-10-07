// The invite dialog says what the chosen role can and cannot do.
//
// MEASURED 2026-10-06: Doty inviting his service manager saw a bare list
// (Admin, Editor, Website, Marketing, Support, Partners, Warehouse, View only).
// roles.ts held a sentence for each, written for exactly this choice, and the
// dialog never showed one (sparx persona issue 120). The console has no render
// tests, so this reads the dialog's source: the role field must draw
// roleDescription(role).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ASSIGNABLE_ROLES, roleDescription } from './roles';

const here = dirname(fileURLToPath(import.meta.url));

describe('the invite dialog', () => {
  it('draws the description of the chosen role under the role field', () => {
    const source = readFileSync(join(here, 'index.tsx'), 'utf8');
    const field = source.slice(source.indexOf('What they will do'));
    expect(field.slice(0, 1500)).toContain('{roleDescription(role)}');
  });

  it('has a real sentence for every role it offers', () => {
    for (const role of ASSIGNABLE_ROLES) {
      expect(roleDescription(role)).not.toContain('does not recognize');
    }
  });
});
