// A refund's words follow how it reached her (sparx persona issue 178). Brynn was
// handed $750.00 at the Gillett counter, and her return page said it was "sent
// back", which sends a customer to her card statement for money she is holding.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { refundedLine, returnState } from './return-status';

describe('refundedLine', () => {
  it('does not say sent back about money handed over', () => {
    expect(refundedLine('by_hand', 'October 9, 2026')).toBe('Given back to you October 9, 2026');
  });

  it('says sent back when it went back to how she paid', () => {
    expect(refundedLine('payment', 'October 9, 2026')).toBe('Sent back October 9, 2026');
  });

  it('calls store credit store credit', () => {
    expect(refundedLine('store_credit', 'October 9, 2026')).toBe(
      'Added to your account October 9, 2026'
    );
  });

  it('claims no route it was not told', () => {
    expect(refundedLine(null, 'October 9, 2026')).toBe('Refunded October 9, 2026');
  });
});

describe('returnState with a route', () => {
  it('words a counter refund as handed back', () => {
    expect(returnState('refunded', 'by_hand').hint).toBe('We gave your money back to you.');
    expect(returnState('refunded', 'by_hand').label).toBe('Refunded');
  });

  it('keeps the plain words where the route is not known, as on the list', () => {
    expect(returnState('refunded').hint).toBe('Your money has gone back.');
  });
});

describe('the return page uses them', () => {
  const page = readFileSync(
    fileURLToPath(
      new URL('../../app/account/(authed)/returns/[returnId]/page.tsx', import.meta.url)
    ),
    'utf8'
  );

  it('passes the route to both lines', () => {
    expect(page).toContain('returnState(detail.status, detail.refundedAs ?? null)');
    expect(page).toContain('refundedLine(detail.refundedAs ?? null,');
    expect(page).not.toContain('Sent back {');
  });
});
