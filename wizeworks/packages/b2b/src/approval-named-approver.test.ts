// A spending rule that names a person has to be binding, and it has to be the
// RIGHT rule that names them.
//
// What this pins, and why each line is here:
//
//   1. A rule naming somebody refuses everyone else. Before this, `approveOrder`
//      looked the order up by status alone and placed it: the rule row carried
//      `requiredApproverUserId`, the console printed "Nadia Osei signs off"
//      beside it, and any editor could sign. The inventory twin has refused
//      this since it shipped, in a comment that reads "a named approver is a
//      named approver". [[feedback_a_fix_leaves_its_neighbour_behind]]
//
//   2. REJECTING is gated on the same name. A rejection cancels a customer's
//      order, so "anybody may refuse it" is the same hole wearing the other
//      outcome.
//
//   3. Which rule governs. Checkout stops at the first rule that matches,
//      because it only needs to know WHETHER to hold. Deciding needs to know
//      WHICH, because two rules covering one order can name two people, and
//      `findFirst` with no `orderBy` would have picked whichever the planner
//      handed back first — a different approver on two identical orders.

import { describe, expect, it } from 'vitest';
import { approverRefusal, ruleGoverningOrder } from './approval.js';

const DEVI = 'db9c1296-1ed4-4109-90ba-adfc090adf50';
const NADIA = '71a8e916-38b7-4479-9ffa-95f2101a97d2';

function rule(over: Partial<Parameters<typeof ruleGoverningOrder>[1][number]> = {}) {
  return {
    accountId: null,
    propertyId: null,
    minAmountCents: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('approverRefusal', () => {
  it('lets the named person through', () => {
    expect(approverRefusal(NADIA, { requiredApproverUserId: NADIA })).toBeNull();
  });

  it('refuses anybody else, and says who to ask', () => {
    expect(
      approverRefusal(DEVI, {
        requiredApproverUserId: NADIA,
        requiredApprover: { name: 'Nadia Osei', email: 'nadia@example.test' },
      })
    ).toBe('This order has to be signed off by Nadia Osei.');
  });

  it('falls back to the email when the person never set a name', () => {
    expect(
      approverRefusal(DEVI, {
        requiredApproverUserId: NADIA,
        requiredApprover: { name: null, email: 'nadia@example.test' },
      })
    ).toBe('This order has to be signed off by nadia@example.test.');
  });

  it('still refuses when the name cannot be read, rather than letting it pass', () => {
    // A join that came back empty is not permission. The sentence loses the
    // name; the refusal does not lose its force.
    expect(approverRefusal(DEVI, { requiredApproverUserId: NADIA })).toBe(
      'This order has to be signed off by the person named on the rule that held it.'
    );
  });

  it('does not refuse when the rule names nobody', () => {
    expect(approverRefusal(DEVI, { requiredApproverUserId: null })).toBeNull();
  });

  it('does not refuse when no rule governs the order at all', () => {
    expect(approverRefusal(DEVI, null)).toBeNull();
  });

  it('refuses a signed-out caller rather than treating absent as allowed', () => {
    // [[feedback_absent_behaves_like_fine]] — `undefined === undefined` is the
    // shape that would have let an unauthenticated path sign.
    expect(approverRefusal(undefined, { requiredApproverUserId: NADIA })).not.toBeNull();
    expect(approverRefusal(null, { requiredApproverUserId: NADIA })).not.toBeNull();
  });
});

describe('ruleGoverningOrder', () => {
  const order = { accountId: 'acct-1', propertyId: 'site-1', totalCents: 20_000 };

  it('returns null when nothing covers the order', () => {
    expect(ruleGoverningOrder(order, [rule({ minAmountCents: 50_000 })])).toBeNull();
  });

  it('holds an order for exactly the threshold', () => {
    // Inclusive, the same as the inventory side and the same as what its form
    // tells the reader out loud.
    expect(ruleGoverningOrder(order, [rule({ minAmountCents: 20_000 })])).not.toBeNull();
  });

  it('treats a null account as every account, and a named one as only that one', () => {
    expect(ruleGoverningOrder(order, [rule({ accountId: null })])).not.toBeNull();
    expect(ruleGoverningOrder(order, [rule({ accountId: 'acct-1' })])).not.toBeNull();
    expect(ruleGoverningOrder(order, [rule({ accountId: 'acct-2' })])).toBeNull();
  });

  it('treats a null site as every site, and a named one as only that one', () => {
    expect(ruleGoverningOrder(order, [rule({ propertyId: null })])).not.toBeNull();
    expect(ruleGoverningOrder(order, [rule({ propertyId: 'site-1' })])).not.toBeNull();
    expect(ruleGoverningOrder(order, [rule({ propertyId: 'site-2' })])).toBeNull();
  });

  it('never fires a rule from another business on this one', () => {
    // The two axes are an AND. One OR across both would route a donut shop's
    // rule onto a machine shop's order (docs/131 §4).
    expect(
      ruleGoverningOrder(order, [rule({ accountId: 'acct-1', propertyId: 'site-2' })])
    ).toBeNull();
  });

  it('gives the strictest threshold the order clears, not the first match', () => {
    const small = rule({ minAmountCents: 5_000 });
    const big = rule({ minAmountCents: 15_000 });
    expect(ruleGoverningOrder(order, [small, big])).toBe(big);
    expect(ruleGoverningOrder(order, [big, small])).toBe(big);
  });

  it('breaks a tie on the older rule, so the answer does not move between reads', () => {
    const older = rule({ minAmountCents: 10_000, createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = rule({ minAmountCents: 10_000, createdAt: '2026-06-01T00:00:00.000Z' });
    expect(ruleGoverningOrder(order, [newer, older])).toBe(older);
    expect(ruleGoverningOrder(order, [older, newer])).toBe(older);
  });

  it('reads a Date the way it reads the string, since Prisma hands back a Date', () => {
    const older = rule({ minAmountCents: 10_000, createdAt: new Date('2026-01-01T00:00:00Z') });
    const newer = rule({ minAmountCents: 10_000, createdAt: new Date('2026-06-01T00:00:00Z') });
    expect(ruleGoverningOrder(order, [newer, older])).toBe(older);
  });

  it('picks the person the strictest rule names, which is the whole point', () => {
    const small = { ...rule({ minAmountCents: 5_000 }), requiredApproverUserId: NADIA };
    const big = { ...rule({ minAmountCents: 15_000 }), requiredApproverUserId: DEVI };
    const governing = ruleGoverningOrder(order, [small, big]);
    expect(approverRefusal(NADIA, governing)).not.toBeNull();
    expect(approverRefusal(DEVI, governing)).toBeNull();
  });
});
