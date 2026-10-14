// The business's own supplier (sparx persona issue 171).
//
// A maker or wholesaler who ships to the customer when sent the order: no product
// list, no system to call, orders by email. Gillett could not have S&B Filters ship
// a fuel tank it already sells: the only kinds on offer were four online services
// and a spreadsheet feed, and a product became a supplier's only by importing it
// from their list. These pin the screens that make that job possible.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { credentialIsMalformed, supplierState, type VendorCredentialField } from './dropship-data';

const orderEmail: VendorCredentialField = {
  key: 'orderEmail',
  label: 'Where they take orders',
  type: 'email',
  required: true,
};

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('the order address', () => {
  it('is caught on the form when it cannot be an email address', () => {
    expect(credentialIsMalformed({ orderEmail: 'orders@sbfilters' }, orderEmail)).toBe(true);
    expect(credentialIsMalformed({ orderEmail: 'orders sbfilters.test' }, orderEmail)).toBe(true);
    expect(credentialIsMalformed({ orderEmail: ' orders@sbfilters.test ' }, orderEmail)).toBe(
      false
    );
  });

  it('leaves a blank box to the "needed" check, and other fields alone', () => {
    expect(credentialIsMalformed({ orderEmail: '' }, orderEmail)).toBe(false);
    expect(
      credentialIsMalformed(
        { shopId: 'not an email' },
        { ...orderEmail, key: 'shopId', type: 'text' }
      )
    ).toBe(false);
  });
});

describe('what the supplier page says about them', () => {
  it('says their orders go by email, not that a catalog syncs', () => {
    const state = supplierState('active', 'direct');
    expect(state.detail).toContain('we email them the order');
    expect(state.detail).not.toContain('catalog');
  });

  it('names the missing address when it fails, not a key or a file', () => {
    const state = supplierState('error', 'direct');
    expect(state.detail).toContain('email address they take orders at');
    expect(state.detail).not.toContain('key');
    expect(state.detail).not.toContain('file');
  });
});

describe('the screens', () => {
  const detail = read('./supplier-detail.tsx');
  const list = read('./suppliers-list.tsx');
  const panel = read('../commerce/product-dropship.tsx');

  it('offers no sync, no browsing and no price rule for a supplier with no product list', () => {
    expect(detail).toContain('const hasCatalog');
    expect(detail).toMatch(/supplier && hasCatalog \? \(\s*<>\s*<Button/);
    expect(detail).toMatch(/\{hasCatalog \? \(\s*<FormSection\s+title="Your selling price"/);
  });

  it('does not call a supplier with nothing to sync "Not synced yet"', () => {
    expect(list).toContain('supplier.capabilities.catalogSync');
  });

  // An order number carries its own letters ("O-000024"); a "#" in front made one
  // order read as two (sparx persona issue 195, found here on the second pass).
  it('prints the customer’s order number as it is', () => {
    for (const file of ['./orders-list.tsx', './order-detail.tsx']) {
      expect(read(file)).not.toMatch(/#\$?\{[^}]*orderNumber/i);
    }
  });

  it('lets the owner choose who ships a product they already sell', () => {
    expect(panel).toMatch(/<ShipFromSupplierSection\s/);
    expect(panel).toMatch(/<HandLinkedActions\s/);
    expect(panel).not.toContain('there is no switch for it here');
  });
});
