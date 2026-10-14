// A LINE ON THE BILL IS NAMED THE WAY THE MODULES SCREEN NAMES IT.
//
// Your sparx bill kept its own table of twelve module names. There are sixteen,
// so Gillett's bill read "staff", lowercase, with nothing under it, at $29.00 a
// month (sparx persona issue 169), and the names it did have disagreed with the
// Modules screen ("Website builder" there was "Website" here).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MODULE_META, moduleBillLabel } from '../modules/data';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('a line on the bill', () => {
  it('is the Modules screen name and line for every module', () => {
    for (const meta of MODULE_META) {
      expect(moduleBillLabel(meta.slug)).toEqual({ name: meta.name, blurb: meta.blurb });
    }
  });

  it('names the team module the way the Modules screen does', () => {
    expect(moduleBillLabel('staff').name).toBe('Your team');
  });

  it('never prints a slug, even for a module the catalog has not heard of', () => {
    expect(moduleBillLabel('loyalty_points').name).not.toMatch(/^[a-z_]+$/);
  });

  it('is not a second table on the bill screen', () => {
    const bill = readFileSync(join(HERE, 'subscription.tsx'), 'utf8');
    expect(bill).not.toMatch(/MODULE_LABELS/);
    expect(bill).toMatch(/moduleBillLabel\(/);
  });
});
