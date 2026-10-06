// What the till offers to take. Ported with the till from Piggles, where it is
// that console's issue 748 (sparx persona issue 061).
//
// A box prefilled with the whole total for everybody files an order a business
// phoned through as settled in full before any money has moved: it never reaches
// what is owed, and it is never invoiced.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { takingNote, whatToOffer } from './sale-taking';

describe('whatToOffer', () => {
  it('offers the whole total at a counter', () => {
    expect(whatToOffer({ total: 96, buysOnAccount: false })).toBe('96.00');
  });

  it('offers the deposits too, because the total includes them', () => {
    // A $400 part with a $150 refundable core deposit is $550 handed over.
    expect(whatToOffer({ total: 550, buysOnAccount: false })).toBe('550.00');
  });

  it('offers nothing when a business is ordering on account', () => {
    // A phoned-in order marked paid never reaches what is owed and is never
    // invoiced, and nothing on screen says so.
    expect(whatToOffer({ total: 96, buysOnAccount: true })).toBe('');
  });

  it('offers nothing on an empty sale rather than 0.00', () => {
    // "Paid in full: $0.00" on an empty till is a statement about nothing.
    expect(whatToOffer({ total: 0, buysOnAccount: false })).toBe('');
  });
});

describe('takingNote', () => {
  it('asks what was handed over at a counter', () => {
    expect(takingNote(false)).toContain('handed');
  });

  it('says nothing is expected today from a business on account', () => {
    const note = takingNote(true);
    expect(note).toContain('Nothing is expected today');
    expect(note).toContain('the whole order shows up under what you are owed');
    // It must not still ask how much was handed over, which is the question
    // that made filling the box in look like the normal thing to do.
    expect(note).not.toContain('How much you were handed');
  });
});

/* ── The pane still asks the question ────────────────────────────────────── */

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

describe('the till', () => {
  const pane = () =>
    readFileSync(
      join(repoRoot(), 'sparx/apps/workbench/surfaces/commerce/sale-detail.tsx'),
      'utf8'
    );

  it('works out who is buying from the same field that prices them', () => {
    // `companyId`, not the employer somebody typed at checkout, and not `type`,
    // which a contact can wear without being filed under anything.
    expect(pane()).toContain('customer?.companyId != null');
  });

  it('fills the box from this file rather than from the total', () => {
    expect(pane()).toContain('whatToOffer(');
  });

  it('still lets a typed number stand', () => {
    // Losing this would make every prefill an overwrite.
    expect(pane()).toContain('if (!amountTouched) setPaid(asking);');
  });
});
