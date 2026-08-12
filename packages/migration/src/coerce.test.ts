import { describe, expect, it } from 'vitest';
import {
  clean,
  isAmbiguousDate,
  isEmail,
  isUrl,
  toBoolean,
  toCents,
  toDecimal,
  toInteger,
  toIsoDate,
  toList,
  toPath,
  toPhoneDigits,
  toSlug,
} from './coerce';

describe('clean', () => {
  it('treats export null-markers as empty', () => {
    // Magento, Salesforce reports and Excel each have their own spelling of "nothing",
    // and importing the literal string is worse than importing nothing.
    for (const marker of ['\\N', '#N/A', 'N/A', '-', '   ']) expect(clean(marker)).toBe('');
  });

  it('keeps real values', () => {
    expect(clean('  Blue Mug ')).toBe('Blue Mug');
  });
});

describe('toCents', () => {
  it('reads plain and formatted amounts', () => {
    expect(toCents('12')).toBe(1200);
    expect(toCents('12.50')).toBe(1250);
    expect(toCents('$1,299.00')).toBe(129900);
    expect(toCents('1299.00 USD')).toBe(129900);
    expect(toCents('£8.99')).toBe(899);
  });

  it('reads European decimal commas', () => {
    expect(toCents('1.299,00')).toBe(129900);
    expect(toCents('8,99')).toBe(899);
  });

  it('reads negatives in both spellings', () => {
    expect(toCents('-5.00')).toBe(-500);
    expect(toCents('(5.00)')).toBe(-500);
  });

  it('rounds sub-cent values rather than truncating', () => {
    expect(toCents('0.005')).toBe(1);
  });

  it('returns undefined for empty and unreadable', () => {
    expect(toCents('')).toBeUndefined();
    expect(toCents('call for price')).toBeUndefined();
    expect(toCents(undefined)).toBeUndefined();
  });
});

describe('toInteger / toDecimal', () => {
  it('reads integers', () => {
    expect(toInteger('12')).toBe(12);
    expect(toInteger('12.0')).toBe(12);
    expect(toInteger('1,200')).toBe(1200);
  });

  it('rounds a fractional count', () => {
    expect(toInteger('12.7')).toBe(13);
  });

  it('reads decimals with a unit suffix', () => {
    expect(toDecimal('2.5 kg')).toBe(2.5);
  });

  it('returns undefined for words', () => {
    expect(toInteger('twelve')).toBeUndefined();
    expect(toDecimal('')).toBeUndefined();
  });
});

describe('toBoolean', () => {
  it('reads the spellings exports use', () => {
    for (const yes of ['TRUE', 'yes', 'Y', '1', 'active', 'visible', 'published'])
      expect(toBoolean(yes)).toBe(true);
    for (const no of ['FALSE', 'no', 'N', '0', 'disabled', 'hidden', 'draft'])
      expect(toBoolean(no)).toBe(false);
  });

  it('returns undefined for anything else, rather than guessing false', () => {
    expect(toBoolean('maybe')).toBeUndefined();
    expect(toBoolean('')).toBeUndefined();
  });
});

describe('toIsoDate', () => {
  it('reads ISO', () => {
    expect(toIsoDate('2026-05-27T14:03:22Z')).toBe('2026-05-27T14:03:22.000Z');
  });

  it('reads a space-separated timestamp', () => {
    expect(toIsoDate('2026-05-27 14:03:22')).toContain('2026-05-27');
  });

  it('reads US slashes with a meridiem', () => {
    expect(toIsoDate('12/25/2026 3:04 PM')).toBe('2026-12-25T15:04:00.000Z');
    expect(toIsoDate('12/25/2026 12:04 AM')).toBe('2026-12-25T00:04:00.000Z');
  });

  it('reads epoch seconds and milliseconds', () => {
    expect(toIsoDate('1767225600')).toBe(new Date(1767225600000).toISOString());
    expect(toIsoDate('1767225600000')).toBe(new Date(1767225600000).toISOString());
  });

  it('returns undefined for nonsense', () => {
    expect(toIsoDate('sometime last spring')).toBeUndefined();
  });
});

describe('isAmbiguousDate', () => {
  it('flags a date that could be read either way', () => {
    expect(isAmbiguousDate('03/04/2026')).toBe(true);
  });

  it('does not flag one that can only be read one way', () => {
    expect(isAmbiguousDate('12/25/2026')).toBe(false);
    expect(isAmbiguousDate('05/05/2026')).toBe(false);
    expect(isAmbiguousDate('2026-03-04')).toBe(false);
  });
});

describe('toList', () => {
  it('splits and trims', () => {
    expect(toList('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('drops empties', () => {
    expect(toList('a,,b,')).toEqual(['a', 'b']);
    expect(toList('')).toEqual([]);
  });

  it('accepts another separator', () => {
    expect(toList('a|b', '|')).toEqual(['a', 'b']);
  });
});

describe('toSlug', () => {
  it('slugifies', () => {
    expect(toSlug('Blue Mug — 12oz')).toBe('blue-mug-12oz');
  });

  it('folds accents rather than dropping the letter', () => {
    expect(toSlug('Café Crème')).toBe('cafe-creme');
  });
});

describe('toPath', () => {
  it('reduces an absolute URL to its path', () => {
    expect(toPath('https://old.example.com/shop/mug?variant=1')).toBe('/shop/mug');
  });

  it('passes a path through and drops the query', () => {
    expect(toPath('/shop/mug?x=1')).toBe('/shop/mug');
  });

  it('gives the root for a bare origin', () => {
    expect(toPath('https://old.example.com')).toBe('/');
  });

  it('returns undefined for a non-URL', () => {
    expect(toPath('mug')).toBeUndefined();
  });
});

describe('isEmail / isUrl / toPhoneDigits', () => {
  it('accepts real emails', () => {
    expect(isEmail('sam@example.com')).toBe(true);
    expect(isEmail('sam+tag@mail.example.co.uk')).toBe(true);
  });

  it('rejects the shapes exports actually contain', () => {
    expect(isEmail('sam@example')).toBe(false);
    expect(isEmail('sam at example.com')).toBe(false);
    expect(isEmail('a@b.com, c@d.com')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('accepts absolute, protocol-relative and rooted URLs', () => {
    expect(isUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isUrl('//cdn.example.com/a.jpg')).toBe(true);
    expect(isUrl('/uploads/a.jpg')).toBe(true);
    expect(isUrl('a.jpg')).toBe(false);
  });

  it('reduces a phone number to digits', () => {
    expect(toPhoneDigits('+1 (555) 010-9999')).toBe('15550109999');
  });
});
