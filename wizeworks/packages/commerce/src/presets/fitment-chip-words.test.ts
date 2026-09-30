// The chips on the Ready-made lists picker.
//
// They used to carry the drill-down: "Make → Model → Engine · Year". Three
// things wrong with that, and the last one is the one a person actually hits:
//
//  1. An arrow is a developer's shorthand for a drill-down.
//  2. The middle dot joins PEERS in every other preset chip on the platform
//     ("Cash · Check · Wire · ACH") and here alone divided the steps from the
//     things that narrow them. One mark, two meanings, one screen.
//  3. It did not fit. silicaui calls a badge "a small pill for labels, counts
//     and statuses" — fixed height, no vertical padding, `white-space: nowrap`
//     — so a long chip is CLIPPED, not wrapped. Measured at a 328px dialog the
//     old string ran 53px past its card.
//
// Spelling it out in words made 3 worse (203px of text became 260px), so the
// chip carries a token instead and the level names stay in the description,
// where they are already written in the owner's own vocabulary (issue 806).

import { describe, expect, it } from 'vitest';

import { commercePresets } from './index';
import { stepWords } from './fitment';

describe('stepWords', () => {
  it('counts one step without a plural', () => {
    expect(stepWords(1)).toBe('1 step');
  });

  it('counts several', () => {
    expect(stepWords(3)).toBe('3 steps');
  });

  it('says none rather than an empty string', () => {
    expect(stepWords(0)).toBe('0 steps');
  });
});

describe('the fourteen ready-made lists', () => {
  const fitment = commercePresets.filter((p) => p.kind === 'fitment');

  it('has all fourteen, each with both chips', () => {
    expect(fitment).toHaveLength(14);
    for (const preset of fitment) {
      expect(preset.summary).toHaveLength(2);
      expect(preset.summary[0]?.label.length).toBeGreaterThan(0);
    }
  });

  // Bound to the REAL fourteen rather than to arguments this test invented.
  it('puts no notation on a badge a business owner reads', () => {
    const offenders: string[] = [];
    for (const preset of fitment) {
      for (const chip of preset.summary) {
        if (/[→·|/]|->/.test(chip.label)) offenders.push(`${preset.slug}: ${chip.label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // The guard that would have caught the clip. A pill cannot wrap, so the only
  // safe chip is a short one; 20 characters is comfortably inside the narrowest
  // column this picker has (192px floor), and "3 departments" is 13.
  it('keeps every chip short enough for a pill that cannot wrap', () => {
    const tooLong = fitment
      .flatMap((p) => p.summary.map((c) => c.label))
      .filter((label) => label.length > 20);
    expect(tooLong).toEqual([]);
  });

  it('says the vehicle list in tokens', () => {
    const vehicle = fitment.find((p) => p.slug === 'fitment-vehicle');
    expect(vehicle?.summary.map((c) => c.label)).toEqual(['3 steps', '4 makes']);
  });

  it('says a one-level list is one step', () => {
    const apparel = fitment.find((p) => p.slug === 'fitment-apparel-sizes');
    expect(apparel?.summary.map((c) => c.label)).toEqual(['1 step', '8 sizes']);
  });
});
