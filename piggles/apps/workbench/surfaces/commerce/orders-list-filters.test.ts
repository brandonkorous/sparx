import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILTERS, CHIP_SERVER_FIELDS, emptyAdvice, orderStatusWords } from './orders-list-filters';
import { shippingState } from './order-tone';
import type { Order } from './order-types';

// An order at a given status reads one of TWO ways, depending on whether the
// customer is having it sent or coming to get it. A chip gathers both up, so
// its own word has to be true of both — or it sends a shop owner to do the
// wrong job on half of what it returns.

function orderAt(status: string, collected: boolean): Order {
  return {
    status,
    fulfilledAt: null,
    cancelledReason: null,
    metadata: collected ? { shippingRateRef: 'collection:in-person' } : {},
  } as unknown as Order;
}

describe('the order chips', () => {
  it('never names a delivery method the chip does not filter by', () => {
    const offenders: string[] = [];
    for (const chip of FILTERS) {
      if (!chip.status) continue;
      const sent = shippingState(orderAt(chip.status, false)).label;
      const fetched = shippingState(orderAt(chip.status, true)).label;
      // Same word either way (a canceled order is canceled however it was
      // going) — nothing to get wrong.
      if (sent === fetched) continue;
      if (chip.label === sent || chip.label === fetched) {
        offenders.push(
          `“${chip.label}” also returns orders marked “${chip.label === sent ? fetched : sent}”`
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the shop list and the wholesale list on one set of words', () => {
    // Both lists import THIS array. The drift that prompted it was the
    // wholesale copy quietly missing a chip.
    expect(FILTERS.map((chip) => chip.value)).toEqual([
      'all',
      'unpaid',
      'to_send',
      'sent',
      'delivered',
      'cancelled',
    ]);
  });

  it('asks for exactly one server answer per chip', () => {
    // Counted over CHIP_SERVER_FIELDS rather than over two field names written
    // out here. This test named `status` and `paymentStatus`, so when the
    // payment field was replaced by `owing` it went on passing while checking a
    // field that no longer existed. A guard that lists what it protects protects
    // only what somebody thought of. [[feedback_structural_checks_go_blind]]
    const fields = [...CHIP_SERVER_FIELDS];
    expect(fields.length).toBeGreaterThan(1);
    for (const chip of FILTERS) {
      const set = fields.filter((field) => (chip as Record<string, unknown>)[field] !== undefined);
      expect(set.length, `chip “${chip.label}” sets ${set.join(' and ')}`).toBeLessThan(2);
    }
  });

  it('asks a question, never a payment column value', () => {
    // "Not paid" asked for `payment_status = 'unpaid'`, which a canceled order
    // carries forever and a part-paid order never carries. The chip that means
    // "money is still owed" has to ask the named question, and no chip may reach
    // for the payment column again. [[feedback_a_fix_leaves_its_neighbour_behind]]
    for (const chip of FILTERS) {
      expect('paymentStatus' in chip, `chip “${chip.label}” filters by the payment column`).toBe(
        false
      );
    }
    const money = FILTERS.find((chip) => chip.value === 'unpaid');
    expect(money?.owing).toBe(true);
  });

  it('never says a word that is untrue of half of what it returns', () => {
    // The chip for money owed returns BOTH an unpaid order and a part-paid one,
    // so "Not paid" was false about every part-paid row it handed back. The
    // order's own money block already prints the word that is true of both.
    const money = FILTERS.find((chip) => chip.value === 'unpaid');
    expect(money?.label).not.toMatch(/Not paid/);
    expect(money?.label).toBe('Still owed');
  });

  it('does not claim a row is marked with the chip’s own word', () => {
    expect(emptyAdvice('', 'They have it')).not.toMatch(/marked/);
    expect(emptyAdvice('', 'They have it')).toContain('Switch back to All');
  });

  it('says nothing about a filter nobody set', () => {
    expect(emptyAdvice('mars', null)).not.toMatch(/filter/);
    expect(emptyAdvice('', null)).toBe('');
  });
});

// NO SURFACE MAY KEEP ITS OWN COPY OF THESE WORDS.
//
// The file above exists because two order lists kept hand-copied chip lists
// that drifted. A THIRD copy was found on Customer orders in act 281, built
// straight out of the stored values, and it had drifted furthest of all: its
// filter said Placed / Fulfilled / Delivered while the badges on its own rows
// said To send / On the way / Collected. "Fulfilled" is the one word
// `shippingState` was written to keep off the screen.
//
// Nothing was broken, nothing failed to build, and one screen had two
// vocabularies for one fact six rows apart. [[feedback_structural_checks_go_blind]]

describe('the order status words', () => {
  const STORED = ['placed', 'fulfilled', 'delivered', 'cancelled', 'refunded'];
  const HOUSE = ['orders-list-filters.ts', 'order-tone.ts'];

  function surfaceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...surfaceFiles(full));
      else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  it('live in one file, and nowhere else', () => {
    const root = join(import.meta.dirname, '..');
    const files = surfaceFiles(root);
    // The denominator. A scan that resolved no files would pass in silence.
    expect(files.length).toBeGreaterThan(100);

    const copies: string[] = [];
    for (const file of files) {
      if (HOUSE.some((name) => file.endsWith(name))) continue;
      const source = readFileSync(file, 'utf8');
      // An object literal mapping stored statuses to strings. Two is a pane
      // making a local distinction; three or more is a vocabulary, and a
      // vocabulary belongs in one place.
      // Plain string matching rather than a built RegExp on purpose: `\s`
      // inside a template literal collapses to a bare `s`, so the first draft
      // of this compiled to `^s*placed:` and could not go red on the very copy
      // it was written for. [[feedback_a_test_that_cannot_go_red]]
      const lines = source.split('\n').map((line) => line.trim());
      const named = STORED.filter((key) =>
        lines.some((line) => line.startsWith(`${key}: '`) || line.startsWith(`${key}: "`))
      );
      // `placed` and `fulfilled` belong to the ORDER status enum and to nothing
      // else. Without them this fired on `FULFILLMENT_STATUS_LABELS`, which is
      // a different enum that happens to share the words delivered / cancelled
      // / refunded — a real vocabulary in its own right, not a copy of this one.
      const isOrderStatus = named.includes('placed') || named.includes('fulfilled');
      if (named.length >= 3 && isOrderStatus) {
        copies.push(`${file.split(/[\\/]/).pop() ?? file}: ${named.join(', ')}`);
      }
    }

    expect(copies, `these surfaces name the stored order statuses themselves`).toEqual([]);
  });
});

describe('orderStatusWords', () => {
  // The search box has the stored status and nothing else, and printed it:
  // "Tamsin Vale · placed" beside a list that calls the same order "To pack"
  // (issue 914).
  it('says what the list chips say', () => {
    expect(orderStatusWords('placed')).toBe('To pack');
    expect(orderStatusWords('fulfilled')).toBe('Packed');
    expect(orderStatusWords('delivered')).toBe('They have it');
    expect(orderStatusWords('cancelled')).toBe('Canceled');
    expect(orderStatusWords('refunded')).toBe('Refunded');
  });

  it('reads a status no chip knows yet as words', () => {
    expect(orderStatusWords('on_hold')).toBe('On hold');
  });
});
