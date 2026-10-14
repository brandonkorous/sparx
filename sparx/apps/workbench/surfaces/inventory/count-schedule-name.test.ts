// A new counting schedule's name follows its choices until someone types one
// (persona issue 253).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { suggestedScheduleName } from './count-schedule-name';

const base = {
  abcClass: 'A' as const,
  zoneName: '',
  cadence: 'monthly' as const,
  intervalDays: 30,
};

describe('the name a new schedule carries', () => {
  it('says what it counts and how often', () => {
    expect(suggestedScheduleName(base)).toBe('Top-value stock, monthly');
    expect(suggestedScheduleName({ ...base, abcClass: '' })).toBe('Everything here, monthly');
    expect(suggestedScheduleName({ ...base, abcClass: 'B', cadence: 'quarterly' })).toBe(
      'Mid-value stock, every quarter'
    );
    expect(
      suggestedScheduleName({
        ...base,
        zoneName: ' Mezzanine ',
        cadence: 'custom',
        intervalDays: 10,
      })
    ).toBe('Top-value stock in Mezzanine, every 10 days');
  });

  it('is what the form uses until the name is typed', () => {
    const form = readFileSync(
      fileURLToPath(new URL('./count-schedule-detail.tsx', import.meta.url)),
      'utf8'
    );
    expect(form).toContain('suggestedScheduleName(');
    expect(form).toMatch(/!nameTyped/);
  });
});
