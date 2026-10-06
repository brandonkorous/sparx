// The ad-hoc markup box reads what an owner types (sparx persona issue 086):
// `parseFloat` stopped at the comma and read "8,50" as 8, without a word.

import { describe, expect, it } from 'vitest';
import { ADHOC, adhocEngineValue, resolveMarkup } from './line-markup';

describe('adhocEngineValue', () => {
  it('reads a fixed amount written with a comma', () => {
    expect(adhocEngineValue('flat', '8,50')).toBe(8.5);
  });

  it('reads a fixed amount written with a currency sign', () => {
    expect(adhocEngineValue('flat', '$15')).toBe(15);
  });

  it('reads a percentage written with a comma', () => {
    expect(adhocEngineValue('percentage', '12,5')).toBe(0.125);
  });

  it('still refuses what is not a number', () => {
    expect(adhocEngineValue('percentage', 'abc')).toBeNull();
    expect(adhocEngineValue('percentage', '')).toBeNull();
  });
});

describe('resolveMarkup', () => {
  it('reads a cost written with a comma', () => {
    const resolved = resolveMarkup(
      '8,50',
      { source: ADHOC, method: 'percentage', value: '0' },
      [],
      'markup'
    );
    expect(resolved.preview?.priceCents).toBe(850);
  });
});
