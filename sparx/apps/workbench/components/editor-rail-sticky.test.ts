// A pinned rail card with cards after it collides with them.
//
// MEASURED 2026-10-06 on Gillett's INV-000015: the pinned Summary covered the
// Payments card as it scrolled up, so "Record a payment" sat behind the totals
// and a click there landed on the Summary (sparx persona issue 096). The card
// pins only while it is the last thing in its rail.

import { describe, expect, it } from 'vitest';

import { EDITOR_RAIL_STICKY } from './editor-rail-sticky';

describe('EDITOR_RAIL_STICKY', () => {
  it('pins only the last card in a rail', () => {
    const classes = EDITOR_RAIL_STICKY.split(' ');
    expect(classes).toContain('@4xl:last:sticky');
    expect(classes.every((name) => name.includes('last:'))).toBe(true);
  });
});
