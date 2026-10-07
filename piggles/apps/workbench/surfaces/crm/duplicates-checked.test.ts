// "No duplicates found" says what was compared.
//
// MEASURED 2026-10-06 on Gillett: two Desmond Achterbergs on one phone number,
// phone matching off (the default), and the screen said "Every customer looks
// unique. Nobody shares an email address, or a name and company." (sparx
// persona issue 108).

import { describe, expect, it } from 'vitest';

import { duplicatesCheckedWords } from './workspace-data';

describe('duplicatesCheckedWords', () => {
  it('names the checks that ran, and says phone numbers were not compared', () => {
    const words = duplicatesCheckedWords(['email', 'name_company']);
    expect(words.checked).toBe('Nobody shares an email address or a surname and employer.');
    expect(words.notChecked).toContain('Phone numbers are not compared');
  });

  it('says nothing about phones when they are compared', () => {
    const words = duplicatesCheckedWords(['email', 'phone', 'name_company']);
    expect(words.checked).toBe(
      'Nobody shares an email address, a phone number or a surname and employer.'
    );
    expect(words.notChecked).toBeNull();
  });

  it('names every rule that is off, not only phone', () => {
    const words = duplicatesCheckedWords(['phone']);
    expect(words.checked).toBe('Nobody shares a phone number.');
    expect(words.notChecked).toBe(
      'Email addresses and surnames and employers are not compared, so two records that share one are not shown. Turn on “The same email address” and “The same surname and employer” under How this app behaves to include them.'
    );
  });
});
