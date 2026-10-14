// The legal line at the foot of every email (sparx persona issue 221). Gillett's
// read "Gillett Diesel Service · Gillett Diesel Service 14812 Heritagecrest Way
// Bluffdale, UT 84065 United States": its postal address starts with its name, and
// the address's line breaks became spaces.

import { describe, expect, it } from 'vitest';
import { legalLine } from '../frame';

const address =
  'Gillett Diesel Service\n14812 Heritagecrest Way\nBluffdale, UT 84065\nUnited States';

describe('legalLine', () => {
  it('names the business once, the address on one line', () => {
    expect(legalLine('Gillett Diesel Service', address)).toBe(
      'Gillett Diesel Service · 14812 Heritagecrest Way, Bluffdale, UT 84065, United States'
    );
  });

  it('puts the name in front of an address that does not start with it', () => {
    expect(legalLine('Rosa Flowers', '412 Alder St\nEugene, OR 97401')).toBe(
      'Rosa Flowers · 412 Alder St, Eugene, OR 97401'
    );
  });

  it('gives the address alone when there is no name', () => {
    expect(legalLine(null, '412 Alder St\r\nEugene, OR 97401\n')).toBe(
      '412 Alder St, Eugene, OR 97401'
    );
  });

  it('does not double a comma a line already ends with', () => {
    expect(legalLine('A', '1 Main St,\nTown')).toBe('A · 1 Main St, Town');
  });
});
