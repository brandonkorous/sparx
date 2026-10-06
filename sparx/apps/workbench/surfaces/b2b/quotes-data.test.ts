// Who a quote is for, and how the Quotes list narrows itself.
//
// The column was headed "Business" and printed a PERSON'S NAME on fourteen of
// the sixteen quotes on this machine, because most quotes have no trade account
// on them by design (issue 763). On the two rows of Juniper Row's own list the
// same woman was the business on one and invisible on the other.

import { describe, expect, it } from 'vitest';
import {
  QUOTE_STATES,
  quoteAsker,
  quoteBusiness,
  quoteEmptyAdvice,
  quoteParty,
  quoteRequestRows,
  quoteTone,
  type QuoteRow,
} from './quotes-data';

function quote(over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: 'q-1',
    number: 'Q-000016',
    accountId: null,
    customerId: null,
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    currency: 'USD',
    validUntil: null,
    customerNote: null,
    poNumber: null,
    delivery: null,
    stage: { id: 's-1', name: 'Draft', customerLabel: 'Draft', stageType: 'draft' },
    lines: [],
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
    account: null,
    customer: null,
    ...over,
  };
}

const LOOM = { id: 'a-1', companyName: 'Loom and Larder' };
const TAMSIN = { id: 'c-1', firstName: 'Tamsin', lastName: 'Vale', email: 'tamsin@example.test' };

describe('who a quote is for', () => {
  it('has no business when no trade account is on it', () => {
    expect(quoteBusiness(quote({ customer: TAMSIN }))).toBeNull();
  });

  it('names the business when there is one', () => {
    expect(quoteBusiness(quote({ account: LOOM, customer: TAMSIN }))).toBe('Loom and Larder');
  });

  it('keeps the person who asked even when a business is on it', () => {
    // The whole defect: both facts arrive on the row and the list drew one.
    // The wholesale orders list next door has always drawn both.
    // [[feedback_fetched_but_never_rendered]]
    const row = quote({ account: LOOM, customer: TAMSIN });
    expect(quoteBusiness(row)).toBe('Loom and Larder');
    expect(quoteAsker(row)).toBe('Tamsin Vale');
  });

  it('falls back to the email when the person has no name on record', () => {
    const row = quote({ customer: { ...TAMSIN, firstName: null, lastName: null } });
    expect(quoteAsker(row)).toBe('tamsin@example.test');
  });

  it('says nobody rather than claiming an unknown business', () => {
    // It used to return the words "Unknown business", which asserts a business
    // exists and that we have mislaid which one. Neither half was true.
    // [[feedback_never_present_absence_as_measurement]]
    expect(quoteParty(quote())).toBeNull();
    expect(quoteAsker(quote())).toBeNull();
  });

  it('prefers the business over the person for the one-line form', () => {
    expect(quoteParty(quote({ account: LOOM, customer: TAMSIN }))).toBe('Loom and Larder');
    expect(quoteParty(quote({ customer: TAMSIN }))).toBe('Tamsin Vale');
  });
});

describe('the three answers', () => {
  it('offers All plus one chip per stage type, and no more', () => {
    expect(QUOTE_STATES.map((entry) => entry.value)).toEqual(['all', 'open', 'accepted', 'closed']);
  });

  it('asks the server for nothing when All is picked', () => {
    expect(QUOTE_STATES[0].state).toBeUndefined();
  });

  it('colors by what the stage MEANS, not by what it is called', () => {
    // Four different stages share `draft`; a tenant may rename every one.
    expect(quoteTone('draft')).toBe('info');
    expect(quoteTone('committed')).toBe('success');
    expect(quoteTone('void')).toBe('neutral');
  });
});

describe('what to try when nothing matched', () => {
  it('says nothing at all when nothing is narrowing the list', () => {
    expect(quoteEmptyAdvice('', null)).toBe('');
  });

  it('does not mention a search when none was typed', () => {
    // The list beside this one told a person who had typed nothing to "try a
    // different word", which sends her looking for a box she never used.
    expect(quoteEmptyAdvice('', 'Accepted')).not.toMatch(/word|search/i);
    expect(quoteEmptyAdvice('', 'Accepted')).toContain('Switch back to All');
  });

  it('does not mention a filter when none is on', () => {
    expect(quoteEmptyAdvice('loom', null)).not.toMatch(/filter/i);
  });

  it('names both when both are on', () => {
    const advice = quoteEmptyAdvice('loom', 'Not answered');
    expect(advice).toMatch(/quote number/i);
    expect(advice).toContain('“Not answered”');
  });

  it('never tells her a quote is MARKED the chip word', () => {
    // A chip gathers several stages at once, so "no quotes marked Not answered"
    // would send her down a table looking for words it does not print.
    expect(quoteEmptyAdvice('', 'Not answered')).not.toMatch(/marked/i);
  });
});

// What a trade buyer said when they sent the request: their PO number, and when
// and where they need it (sparx persona issue 086). The business prices a job
// differently for a truck yard next Tuesday than for a counter pickup.
describe('what the buyer asked for besides the items', () => {
  it('lists the PO number and the delivery needs, in the order the buyer reads them', () => {
    const rows = quoteRequestRows(
      quote({
        poNumber: 'WFUC-24-0901',
        delivery: { neededBy: '2026-10-20', deliverTo: 'Yard 2', notes: 'Forklift on site' },
      })
    );
    expect(rows.map((r) => r.label)).toEqual([
      'Their PO number',
      'Needed by',
      'Deliver to',
      'Delivery notes',
    ]);
    expect(rows[0]?.value).toBe('WFUC-24-0901');
    expect(rows[2]?.value).toBe('Yard 2');
  });

  it('reads the needed-by day as that calendar day wherever the reader is', () => {
    const rows = quoteRequestRows(
      quote({ delivery: { neededBy: '2026-10-20', deliverTo: null, notes: null } })
    );
    expect(rows).toEqual([{ label: 'Needed by', value: expect.stringContaining('20') }]);
    expect(rows[0]?.value).toMatch(/Oct/);
  });

  it('shows nothing it was not told', () => {
    expect(quoteRequestRows(quote())).toEqual([]);
  });
});
