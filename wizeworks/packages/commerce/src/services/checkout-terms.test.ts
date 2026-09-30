// Who may put an order on payment terms, and what they are told when they may not.
//
// ── The defects these cover ──────────────────────────────────────────────────
//
// This decision was four `if`s inside `complete()`, behind a database
// transaction, so nothing could reach it and nothing did. Two things were
// wrong with it.
//
//   1. **Inactive stopped nothing.** The console calls that state "kept on file
//      but not trading", and it was the one account state the order path never
//      looked at. A business marked as not trading could keep ordering on
//      terms.
//
//   2. **An unreadable figure waved the order through.** The test was
//      `orderDollars > available`, and every comparison against `NaN` is false,
//      so a limit that would not parse granted infinite credit rather than
//      none.
//
// The zero limit is not a defect here — it is the rule. `credit_limit` is
// `NUMERIC NOT NULL DEFAULT 0` and this sum is the only thing that reads it,
// so a company nobody has given a limit is refused. MEASURED 2026-09-25 on the
// dev database: all ten Active companies sit at zero. What was wrong was the
// console, which told their owner they could order on terms.
// [[feedback_a_promise_in_copy_is_a_contract]]
// [[feedback_screen_over_a_function_nobody_calls]]

import { describe, expect, it } from 'vitest';
import { termsRefusal } from './checkout-service';

/** An account good for $5,000, owing $1,193 of it. */
const open = { status: 'active', creditLimit: '5000.00', creditUsed: '1193.00' };

describe('termsRefusal', () => {
  it('lets an order through when the account has room for it', () => {
    // $3,807 left. A $1,000 order fits.
    expect(termsRefusal(open, 100000, 'USD')).toBeNull();
    // Exactly the remaining credit still fits: the limit is a ceiling, not a wall
    // one cent below it.
    expect(termsRefusal(open, 380700, 'USD')).toBeNull();
  });

  it('refuses an order a cent past the limit, and says both figures', () => {
    const message = termsRefusal(open, 380800, 'USD');
    expect(message).toContain('$3,808.00');
    expect(message).toContain('$3,807.00 of credit left');
    expect(message).toContain('ask your account manager to raise the limit');
  });

  it('refuses every order against a limit nobody set', () => {
    const zero = { status: 'active', creditLimit: '0.00', creditUsed: '0.00' };
    expect(termsRefusal(zero, 100, 'USD')).toContain('no credit left');
    // Not even a zero-value order, which is what "no credit" means.
    expect(termsRefusal(zero, 1, 'USD')).toContain('no credit left');
  });

  it('stops an account that is on hold before it does the arithmetic', () => {
    // Plenty of room, but held. The hold is the answer, not the balance.
    const held = { status: 'credit_hold', creditLimit: '5000.00', creditUsed: '0.00' };
    expect(termsRefusal(held, 100, 'USD')).toContain('credit hold');
  });

  it('stops a suspended account', () => {
    const off = { status: 'suspended', creditLimit: '5000.00', creditUsed: '0.00' };
    expect(termsRefusal(off, 100, 'USD')).toContain('suspended');
  });

  it('stops an account marked as not trading', () => {
    // The hole. `inactive` was checked nowhere in the order path, so the one
    // state that means "we are not trading with these people" let every order
    // through on whatever credit it happened to have.
    const dormant = { status: 'inactive', creditLimit: '5000.00', creditUsed: '0.00' };
    expect(termsRefusal(dormant, 100, 'USD')).toContain('not currently trading');
  });

  it('refuses rather than allows when a figure cannot be read', () => {
    // `Number('')` is NaN and `x > NaN` is false, so the old comparison read an
    // unreadable limit as unlimited credit.
    const broken = { status: 'active', creditLimit: 'n/a', creditUsed: '0.00' };
    expect(termsRefusal(broken, 100, 'USD')).not.toBeNull();
    const noUsed = { status: 'active', creditLimit: '5000.00', creditUsed: 'n/a' };
    expect(termsRefusal(noUsed, 100, 'USD')).not.toBeNull();
    const nulls = { status: 'active', creditLimit: null, creditUsed: null };
    expect(termsRefusal(nulls, 100, 'USD')).not.toBeNull();
  });

  it('says the amounts in the currency the order is in', () => {
    const message = termsRefusal(open, 999900, 'EUR');
    expect(message).not.toContain('$');
    expect(message).toContain('9,999');
  });
});
