// "Collect in person" says where (sparx persona issue 191). Renée chose to collect
// and was told who it was put aside for and that she would get a call, but not
// where to go.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { addressOnOneLine } from '../../lib/address-line';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('the collect step names the place', () => {
  it('the checkout page hands over the business address', () => {
    expect(read('../../app/checkout/page.tsx')).toContain('collectAt={site.contact.address}');
  });

  it('both ways into the collect step pass it on', () => {
    const flow = read('./checkout-flow.tsx');
    expect(flow.match(/collectAt=\{collectAt\}/g)?.length).toBe(2);
  });

  it('the step draws it', () => {
    expect(read('./collection-step.tsx')).toMatch(
      /Collect it from[\s\S]*\{addressOnOneLine\(collectAt\)\}/
    );
  });

  // On screen it read "14812 Heritagecrest Way Bluffdale, UT 84065": the address
  // is kept on two lines, and a sentence folds the line break into a space.
  it('puts a two-line address in a sentence with a comma between the lines', () => {
    expect(addressOnOneLine('14812 Heritagecrest Way\nBluffdale, UT 84065')).toBe(
      '14812 Heritagecrest Way, Bluffdale, UT 84065'
    );
    expect(addressOnOneLine('Unit 4, 220 Concord Park Dr,\r\n\r\n  Concord, CA 94520 ')).toBe(
      'Unit 4, 220 Concord Park Dr, Concord, CA 94520'
    );
    expect(addressOnOneLine('14812 Heritagecrest Way, Bluffdale, UT 84065')).toBe(
      '14812 Heritagecrest Way, Bluffdale, UT 84065'
    );
  });

  // The same paragraph said "We’ll put this aside" and then "We'll call".
  it('the step uses one kind of apostrophe', () => {
    expect(read('./collection-step.tsx')).not.toMatch(/\b(We'll|it's)\b/);
  });
});
