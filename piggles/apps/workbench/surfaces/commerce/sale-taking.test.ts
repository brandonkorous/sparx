// What the till offers to take. Issue 748.
//
// The box was prefilled with the whole total for everybody, so an order a shop
// phoned through came out settled in full before a penny had moved. There were
// no wholesale orders anywhere on this machine to catch it with, which is the
// other half of why it lasted: the screen was only ever opened for the case it
// was built for.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { takingNote, whatToOffer } from './sale-taking';

describe('whatToOffer', () => {
  it('offers the whole total at a counter', () => {
    expect(whatToOffer({ depositAsked: null, total: 96, buysOnAccount: false })).toBe('96.00');
  });

  it('offers nothing when a shop is ordering on account', () => {
    // The whole issue. A phoned-in order marked paid never reaches what she is
    // owed and is never invoiced, and nothing on screen says so.
    expect(whatToOffer({ depositAsked: null, total: 96, buysOnAccount: true })).toBe('');
  });

  it('does not take a deposit from a shop on account either', () => {
    // The first version of this let a deposit outrank buying on account, and
    // driving it wrote a captured $30.00 payment onto O-000018 that nobody had
    // made. A deposit is what is DUE before something is made, which is the
    // same moment as taking it at a counter and a different one on the phone.
    expect(whatToOffer({ depositAsked: 25, total: 96, buysOnAccount: true })).toBe('');
  });

  it('still asks for a deposit at a counter', () => {
    expect(whatToOffer({ depositAsked: 25, total: 96, buysOnAccount: false })).toBe('25.00');
  });

  it('offers nothing on an empty sale rather than 0.00', () => {
    // "Paid in full: $0.00" on an empty till is a statement about nothing.
    expect(whatToOffer({ depositAsked: null, total: 0, buysOnAccount: false })).toBe('');
  });

  it('offers nothing when a deposit rule works out to nothing', () => {
    expect(whatToOffer({ depositAsked: 0, total: 96, buysOnAccount: false })).toBe('');
  });
});

describe('takingNote', () => {
  it('asks what she was handed at a counter', () => {
    expect(takingNote(false)).toContain('handed');
  });

  it('says nothing is expected today from a shop on account', () => {
    const note = takingNote(true);
    expect(note).toContain('Nothing is expected today');
    expect(note).toContain('the whole order shows up under what you are owed');
    // It must not still ask how much she was handed, which is the question that
    // made filling the box in look like the normal thing to do.
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
      join(repoRoot(), 'piggles/apps/workbench/surfaces/commerce/sale-detail.tsx'),
      'utf8'
    );

  it('works out who is buying from the same field that prices them', () => {
    // `companyId`, not the employer somebody typed at checkout (issue 746) and
    // not `type`, which a contact can wear without being filed under anything.
    expect(pane()).toContain('customer?.companyId != null');
  });

  it('fills the box from this file rather than from the total', () => {
    const body = pane();
    expect(body).toContain('whatToOffer(');
    expect(body).not.toContain('asking > 0 ? asking.toFixed(2)');
  });

  it('still lets a typed number stand', () => {
    // The older half of the same idea, and the reason issue 737 could be closed
    // without a decision. Losing it would make every prefill an overwrite.
    expect(pane()).toContain('if (!amountTouched) setPaid(asking);');
  });
});
