// Barcode symbology, check digits, and scan equivalence (docs/146 Phase 3.1).
//
// The check-digit maths is the reason this file exists. It runs on the server
// when a code is registered and in the browser when a label is printed, and if
// the two ever disagree the symptom is four hundred printed labels that will not
// scan — discovered by somebody in a warehouse, not by anybody here. Every
// expectation below is a real, published code rather than one this code produced.

import { describe, expect, it } from 'vitest';
import {
  detectSymbology,
  expandUpcE,
  gs1CheckDigit,
  internalBarcode,
  isGtin,
  isInternalBarcode,
  normalizeBarcode,
  scanEquivalents,
  validateBarcode,
  withGs1CheckDigit,
} from './barcodes';

describe('gs1CheckDigit', () => {
  // One calculation covers UPC-A, EAN-8, EAN-13 and GTIN-14 — the weights run
  // 3,1 from the rightmost payload digit regardless of length.
  it.each([
    ['UPC-A', '03600029145', 2],
    ['EAN-13', '400638133393', 1],
    ['EAN-8', '9638507', 4],
    ['GTIN-14', '1003600029145', 9],
  ])('computes the %s check digit', (_label, payload, expected) => {
    expect(gs1CheckDigit(payload)).toBe(expected);
  });

  it('appends rather than replacing', () => {
    expect(withGs1CheckDigit('03600029145')).toBe('036000291452');
  });

  it('refuses a non-numeric payload instead of returning a plausible digit', () => {
    expect(() => gs1CheckDigit('ABC123')).toThrow(/numeric/i);
  });
});

describe('normalizeBarcode', () => {
  it('strips the whitespace that defeats the unique index', () => {
    expect(normalizeBarcode('  0360 0029 1452 ')).toBe('036000291452');
  });

  it('upper-cases Code 39, which is case-insensitive', () => {
    expect(normalizeBarcode('ab-123', 'code_39')).toBe('AB-123');
  });

  it('leaves Code 128 case alone — the payload is arbitrary and casing is meaning', () => {
    expect(normalizeBarcode('SkU-aB12', 'code_128')).toBe('SkU-aB12');
  });
});

describe('detectSymbology', () => {
  it.each([
    ['96385074', 'ean_8'],
    ['036000291452', 'upc_a'],
    ['4006381333931', 'ean_13'],
    ['10036000291459', 'gtin_14'],
    ['SPX-WIDGET-01', 'code_128'],
    ['1234567', 'code_128'], // seven digits is no GTIN length at all
  ])('reads %s as %s', (value, expected) => {
    expect(detectSymbology(value)).toBe(expected);
  });
});

describe('expandUpcE', () => {
  // The four suppression rules, each keyed on the last data digit.
  it.each([
    ['01234565', '012345000065'], // last digit 5-9: the five leading digits, 0000, then it
    ['04252658', '042526000058'], // same branch, different payload
    ['04252641', '042520000061'], // last digit 4: four digits, 00000, then the fifth
    ['04252635', '042500000265'], // last digit 3: three digits, 00000, then two
    ['04252614', '042100005264'], // last digit 0-2: two digits, it, 0000, then three
  ])('expands %s to %s', (short, full) => {
    expect(expandUpcE(short)).toBe(full);
  });

  it('produces expansions that are themselves valid UPC-A codes', () => {
    // The suppression rules are only correct if the check digit survives them —
    // a rearrangement that changes the payload would break silently otherwise.
    for (const short of ['01234565', '04252658', '04252641', '04252635', '04252614']) {
      expect(validateBarcode(expandUpcE(short)!, 'upc_a').ok).toBe(true);
    }
  });

  it('returns null for a number system that has no UPC-E form', () => {
    expect(expandUpcE('51234565')).toBeNull();
  });

  it('returns null for the wrong length', () => {
    expect(expandUpcE('0123456')).toBeNull();
  });
});

describe('scanEquivalents', () => {
  // Which encoding arrives is a property of how the gun is configured, not of
  // the item. Resolution has to try all of them or "we registered the barcode
  // and it still says unknown" becomes a ticket nobody can diagnose.
  it('offers a UPC-A its EAN-13 reading', () => {
    expect(scanEquivalents('036000291452')).toContain('0036000291452');
  });

  it('offers a zero-led EAN-13 its UPC-A reading', () => {
    expect(scanEquivalents('0036000291452')).toContain('036000291452');
  });

  it('offers a UPC-E its expanded UPC-A', () => {
    expect(scanEquivalents('01234565')).toContain('012345000065');
  });

  it('always includes the value as scanned, first', () => {
    expect(scanEquivalents('  0360 0029 1452')[0]).toBe('036000291452');
  });

  it('does not invent alternates for a Code 128 payload', () => {
    expect(scanEquivalents('SPX-WIDGET-01')).toEqual(['SPX-WIDGET-01']);
  });
});

describe('validateBarcode', () => {
  it('accepts a real UPC-A', () => {
    expect(validateBarcode('036000291452')).toMatchObject({ ok: true, symbology: 'upc_a' });
  });

  it('names the digit that should have been there', () => {
    // One mis-typed digit is the overwhelmingly common failure, and saying which
    // one turns "invalid" into something the person holding the box can fix.
    const result = validateBarcode('036000291453');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/should end in 2, not 3/);
  });

  it('reports the length it actually got', () => {
    const result = validateBarcode('03600029145', 'upc_a');
    expect(result.error).toMatch(/12 digits — this one has 11/);
  });

  it('validates a UPC-E through its expansion', () => {
    expect(validateBarcode('01234565', 'upc_e').ok).toBe(true);
    expect(validateBarcode('01234560', 'upc_e').ok).toBe(false);
  });

  it('accepts Code 128 as typed — the symbology has no check digit to verify', () => {
    expect(validateBarcode('SPX-WIDGET-01', 'code_128')).toMatchObject({ ok: true });
  });

  it('holds Code 39 to its restricted character set', () => {
    expect(validateBarcode('WIDGET_01', 'code_39').ok).toBe(false);
    expect(validateBarcode('WIDGET-01', 'code_39').ok).toBe(true);
  });

  it('rejects letters in a numeric symbology before trying the check digit', () => {
    expect(validateBarcode('03600029145X', 'upc_a').error).toMatch(/digits only/);
  });

  it('normalizes before validating, so a pasted value with spaces passes', () => {
    expect(validateBarcode('0360 0029 1452')).toMatchObject({ ok: true, value: '036000291452' });
  });
});

describe('internalBarcode', () => {
  it('mints a valid UPC-A in the restricted-circulation range', () => {
    const code = internalBarcode(1n);
    expect(code).toHaveLength(12);
    expect(code.startsWith('2')).toBe(true);
    // The point of using a real symbology: it validates like any other UPC.
    expect(validateBarcode(code, 'upc_a').ok).toBe(true);
  });

  it('is stable and distinct across the sequence', () => {
    expect(internalBarcode(1n)).not.toBe(internalBarcode(2n));
    expect(internalBarcode(42n)).toBe(internalBarcode(42n));
  });

  it('validates at the top of the range', () => {
    expect(validateBarcode(internalBarcode(9_999_999_999n), 'upc_a').ok).toBe(true);
  });

  it('refuses a sequence it cannot encode rather than truncating', () => {
    expect(() => internalBarcode(10_000_000_000n)).toThrow(/out of range/);
    expect(() => internalBarcode(0n)).toThrow(/out of range/);
  });

  it('recognises its own codes and not a manufacturer’s', () => {
    expect(isInternalBarcode(internalBarcode(7n))).toBe(true);
    expect(isInternalBarcode('036000291452')).toBe(false);
  });
});

describe('isGtin', () => {
  // The gate on mirroring down into `ProductVariant.barcode`: the feeds mean a
  // GTIN by "barcode", and our internal Code 128 means nothing to them.
  it.each([
    ['upc_a', true],
    ['ean_13', true],
    ['itf_14', true],
    ['code_128', false],
    ['qr', false],
    ['other', false],
  ] as const)('%s → %s', (symbology, expected) => {
    expect(isGtin(symbology)).toBe(expected);
  });
});
