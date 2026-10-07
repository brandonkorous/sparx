import { describe, expect, it } from 'vitest';
import { COUNT_SURFACE, SOURCES, type AttentionKey } from '../../lib/console/home-counts';
import { STATUS_FILTERS, parseStatusFilter } from '../builder/form-submissions-filters';
import { parseUnread } from '../chat/inbox-filters';
import { FILTERS, parseOrderFilter } from '../commerce/orders-list-filters';
import { parseLevel } from '../inventory/stock-list-level';
import { parseLate } from '../invoicing/invoice-list-filters';
import { parseBookingStatus } from '../scheduling/bookings-list-filters';
import { SIGNALS, actionsForAnswer, reassuresFor } from './signals';

/**
 * "4 ORDERS ARE WAITING TO GO OUT" OPENED EVERY ORDER THE SHOP HAD TAKEN.
 *
 * A sentence on Home that names a count promises the screen behind it shows
 * THAT count. "1 item is sold out" opened 62 unnarrowed rows with the one ninth
 * ([258]), and the fix went onto that row and the website-forms row only. Orders,
 * bookings and late invoices opened their whole lists; chat opened every
 * conversation, answered ones included; and the forms row SENT `status: 'new'`
 * to an inbox that never read it.
 *
 * So this holds every sentence to the count behind it, through the pane's OWN
 * parser: what the screen asks the server, opened from Home, has to be the
 * question the number was measured with. A value the pane does not recognise is
 * read as "no narrowing", so a typo here fails as an unnarrowed list rather than
 * compiling quietly.
 */

type Query = Record<string, string>;

/**
 * What each pane asks the server when opened with these params — the filter
 * half only, not paging or sort. Each is the pane's own parser plus the same
 * mapping its query function applies.
 */
const PANE_QUERY: Record<string, (params: Record<string, string>) => Query> = {
  'commerce.orders.list': (params): Query => {
    const chip = FILTERS.find((entry) => entry.value === parseOrderFilter(params.show));
    return {
      ...(chip?.status ? { status: chip.status } : {}),
      ...(chip?.owing ? { owing: 'true' } : {}),
    };
  },
  'invoicing.invoices.list': (params): Query => {
    const late = parseLate(params.pastDue);
    return late === 'all' ? {} : { pastDue: late };
  },
  'scheduling.bookings.list': (params): Query => {
    const status = parseBookingStatus(params.status);
    return status ? { status } : {};
  },
  'builder.forms': (params): Query => {
    const chip = STATUS_FILTERS.find((entry) => entry.value === parseStatusFilter(params.status));
    return chip?.status ? { status: chip.status } : {};
  },
  'chat.inbox': (params): Query => (parseUnread(params.unread) ? { unread: 'true' } : {}),
  'inventory.stock.list': (params): Query => {
    const level = parseLevel(params.level);
    if (level === 'low') return { low_stock_only: 'true', sellable_only: 'true' };
    if (level === 'out') return { out_of_stock_only: 'true' };
    return {};
  },
};

/** The count's question, with the page size taken off: `take`, `skip` and
 *  `limit` say how many rows to send back, not which rows count. */
function countQuestion(key: AttentionKey): Query {
  const question: Query = {};
  for (const [field, value] of Object.entries(SOURCES[key].query)) {
    if (field === 'take' || field === 'skip' || field === 'limit') continue;
    question[field] = String(value);
  }
  return question;
}

describe('a sentence on Home opens the screen showing its number', () => {
  it('opens the screen the count is measured on', () => {
    // Bookings were counted on the bookings list and sent to the calendar: a
    // week's grid, where a request for next month was not on screen.
    for (const signal of SIGNALS) {
      expect(signal.surface, signal.key).toBe(COUNT_SURFACE[signal.key]);
    }
  });

  it('narrows that screen to the rows the count counted', () => {
    const offenders: string[] = [];
    for (const signal of SIGNALS) {
      const pane = PANE_QUERY[signal.surface];
      // Loud, not skipped: a new sentence on a screen this file has not been
      // taught about must fail here rather than pass by being left out.
      if (!pane) {
        offenders.push(`${signal.key}: opens ${signal.surface}, which this file cannot read`);
        continue;
      }
      const asked = pane(signal.params ?? {});
      const counted = countQuestion(signal.key);
      if (JSON.stringify(sortKeys(asked)) !== JSON.stringify(sortKeys(counted))) {
        offenders.push(
          `${signal.key}: Home counts ${JSON.stringify(counted)} but the screen asks ${JSON.stringify(asked)}`
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('checks every sentence Home can say', () => {
    // The denominator. An empty list would pass both loops above.
    expect(SIGNALS.length).toBeGreaterThanOrEqual(7);
    for (const key of ['orders', 'bookings', 'invoices', 'messages', 'formReplies'] as const) {
      expect(
        SIGNALS.some((signal) => signal.key === key),
        key
      ).toBe(true);
    }
  });

  it('reads a value the pane does not know as no narrowing, never a guess', () => {
    const unnarrowed = {
      show: 'bogus',
      pastDue: 'yes',
      status: 'overdue',
      unread: '1',
      level: 'none',
    };
    for (const pane of Object.values(PANE_QUERY)) {
      expect(pane(unnarrowed)).toEqual({});
    }
  });
});

function sortKeys(query: Query): Query {
  return Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
}

describe('Start something follows what the business said it does (issue 941)', () => {
  it('offers a journal writing and its site, never a product or an invoice', () => {
    const labels = actionsForAnswer(['web', 'people']).map((action) => action.label);
    expect(labels).toEqual(['Write something', 'Add a customer', 'Work on my site']);
  });

  it('keeps the four it always had for a business that never answered', () => {
    const labels = actionsForAnswer(null).map((action) => action.label);
    expect(labels).toEqual([
      'Add a product',
      'Send an invoice',
      'Add a customer',
      'Work on my site',
    ]);
  });
});

describe('the all-clear sentence follows what the business said it does (issue 941)', () => {
  it('spares a journal the stock and order reassurance', () => {
    expect(reassuresFor('inventory', ['web', 'people'])).toBe(false);
    expect(reassuresFor('commerce', ['web', 'people'])).toBe(false);
    expect(reassuresFor('scheduling', ['web', 'people'])).toBe(true);
  });

  it('says all of it to a business that never answered', () => {
    expect(reassuresFor('inventory', null)).toBe(true);
  });
});
