// A delivery region can be limited to chosen countries (sparx persona issue 127).
//
// "Deliver anywhere in the world" was read from "no countries chosen". Turning it
// off left the list empty, so it flipped straight back on, the country picker
// never appeared, and every new region delivered worldwide.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { regionCoverageError } from './shipping-data';

describe('the coverage of a delivery region', () => {
  it('cannot be limited to countries with none chosen', () => {
    expect(regionCoverageError({ limited: true, countries: [] })).toMatch(/at least one country/);
  });

  it('is fine everywhere, or with a country chosen', () => {
    expect(regionCoverageError({ limited: false, countries: [] })).toBeNull();
    expect(regionCoverageError({ limited: true, countries: ['US'] })).toBeNull();
  });

  it('keeps "anywhere" as its own choice, not read from an empty list', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'shipping-zone-detail.tsx'), 'utf8');
    expect(source).toContain('const everywhere = !draft.limited;');
    expect(source).not.toMatch(/const everywhere = draft\.countries\.length === 0/);
  });
});
