// Who a picker row is ABOUT. Issue 746.
//
// The console had two answers to "what is this customer called" and the till
// used the wrong one, so the screen that decides what somebody is charged named
// every row with the employer they had typed into a checkout box. 605 of the
// 745 contacts on this machine have one of those, and 4 of the 11 people who
// really do buy for a business have none — so the rows that looked like
// businesses were the ones that were not.
//
// The pair below is the whole rule: a PERSON is named by `customerName`, a
// DOCUMENT is addressed by `billingName`, and they are allowed to differ.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { billingName, customerPickerRow, type CustomerSummary } from './customer-picker-data';

const LOOM = '9b6d9f03-578b-4388-8ff7-d3ad08f3840d';

function customer(over: Partial<CustomerSummary> = {}): CustomerSummary {
  return {
    id: 'c1',
    firstName: 'Tamsin',
    lastName: 'Vale',
    company: null,
    email: 'tamsin@loomandlarder.com',
    type: 'retail',
    companyId: null,
    ...over,
  };
}

/* ── The name on the row is the person ───────────────────────────────────── */

describe('customerPickerRow', () => {
  it('names a shopper who typed an employer after the SHOPPER', () => {
    // Priya Nandakumar wrote "Loom & Larder" in a box at checkout. She is a
    // private customer at full price, and the picker used to offer her as the
    // business — the one row that looked wholesale being the one that was not.
    const row = customerPickerRow(
      customer({
        firstName: 'Priya',
        lastName: 'Nandakumar',
        company: 'Loom & Larder',
        email: 'priya@loomandlarder.co.uk',
      })
    );

    expect(row.primary).toBe('Priya Nandakumar');
    expect(row.primary).not.toBe('Loom & Larder');
  });

  it('wears no mark on a plain retail individual', () => {
    expect(customerPickerRow(customer()).mark).toBeNull();
  });

  it('marks a wholesale buyer, because that is what changes the price', () => {
    const row = customerPickerRow(customer({ type: 'b2b', companyId: LOOM }), 'Loom and Larder');
    // `module-b2b`, not `b2b`: the module hues are registered under that
    // prefix, and an unregistered name emits no class and renders grey (747).
    expect(row.mark).toEqual({ label: 'Wholesale', color: 'module-b2b' });
  });

  it('leads the second line with the business that prices them', () => {
    const row = customerPickerRow(customer({ type: 'b2b', companyId: LOOM }), 'Loom and Larder');
    expect(row.secondary).toBe('Loom and Larder · tamsin@loomandlarder.com');
  });

  it('falls back to the typed employer when no business prices them', () => {
    const row = customerPickerRow(
      customer({ firstName: 'Priya', lastName: 'Nandakumar', company: 'Loom & Larder' })
    );
    expect(row.secondary).toBe('Loom & Larder · tamsin@loomandlarder.com');
  });

  it('says only the email when there is neither', () => {
    expect(customerPickerRow(customer()).secondary).toBe('tamsin@loomandlarder.com');
  });

  it('does not repeat the email underneath itself', () => {
    // Somebody with no name at all IS their email up top, so saying it twice is
    // a row that tells you one thing and looks like it tells you two.
    const row = customerPickerRow(customer({ firstName: null, lastName: null }));
    expect(row.primary).toBe('tamsin@loomandlarder.com');
    expect(row.secondary).toBeNull();
  });

  it('never shows an empty second line', () => {
    const row = customerPickerRow(customer({ email: null }));
    expect(row.secondary).toBeNull();
  });
});

/* ── The name on a document is still the business ────────────────────────── */

describe('billingName', () => {
  it('addresses an invoice to the business somebody buys for', () => {
    expect(billingName(customer({ company: 'Loom & Larder' }))).toBe('Loom & Larder');
  });

  it('addresses it to the person when there is no business', () => {
    expect(billingName(customer())).toBe('Tamsin Vale');
  });
});

/* ── The two are not the same function ───────────────────────────────────── */

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('pnpm-workspace.yaml not found above this test');
}

// THIS console only. The other one has the same file and the same test in it,
// and reading across would make either product undeletable — which is the rule
// `check:boundaries` exists to hold. Parity between the two is
// `check:console-parity`'s job, not this file's.
const APP = 'sparx/apps/workbench';

describe('the screens that name a person', () => {
  const read = (rel: string) => readFileSync(join(repoRoot(), APP, rel), 'utf8');

  it.each([
    'surfaces/invoicing/customer-picker.tsx',
    'surfaces/b2b/account-detail.tsx',
    'surfaces/commerce/repeat-order-new.tsx',
  ])('%s does not address a human the way it addresses an invoice', (file) => {
    expect(read(file)).not.toContain('billingName(');
  });

  it('the bill-to field still prints the business on the document', () => {
    expect(read('surfaces/invoicing/bill-to.tsx')).toContain('billingName(');
  });

  it('the picker resolves the business a buyer is filed under', () => {
    // Without this lookup the mark says "Wholesale" and never says which shop,
    // which is no use to somebody supplying six of them.
    const body = read('surfaces/invoicing/customer-picker.tsx');
    expect(body).toContain('useAccounts');
    expect(body).toContain('customer.companyId');
  });
});
