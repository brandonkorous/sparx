// A button that does part of a job says which part (persona issue 273): "693
// items you sell cannot be scanned" over a button reading "Create 200 barcodes".

import { describe, expect, it } from 'vitest';

import { createBarcodesLabel } from './barcode-words';

describe('the create-barcodes button', () => {
  it('says it covers part of the list when it does', () => {
    expect(createBarcodesLabel(200, 693)).toBe('Create 200 of 693 barcodes');
  });

  it('says the plain count when it covers them all', () => {
    expect(createBarcodesLabel(12, 12)).toBe('Create 12 barcodes');
    expect(createBarcodesLabel(1, 1)).toBe('Create 1 barcode');
    expect(createBarcodesLabel(5)).toBe('Create 5 barcodes');
  });
});
