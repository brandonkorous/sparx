'use client';

// ══════════════════════════════════════════════════════════════════════════
// QUOTES / RFQ — a read lens over the billing engine.
//
// A B2B quote is a billing document on the built-in "b2b-quotes" workflow: a
// business asks what a job or a bulk order would cost, you price it up, and they
// accept or decline. Pricing the lines and advancing it through its stages
// (Draft → Submitted → … → Accepted/Declined) is the invoicing editor's job —
// this file only READS the B2B-scoped projection the api-rest quotes route
// serves. The detail hands off to that editor to actually respond.
//
//   ['b2b','quotes']              the root
//   ['b2b','quotes','list',{…}]   the list window
//   ['b2b','quotes', id]          one quote
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { formatAmount } from '../../lib/money-format';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The workflow stage a quote sits on. `stageType` is the lifecycle bucket the
 *  tone derives from; `name` is the tenant's own label for it. */
export interface QuoteStage {
  id: string;
  name: string;
  customerLabel: string | null;
  stageType: string; // draft | committed | void
}

/** One line of a quote: what was asked for, how many, and at what price. */
export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** One quote, as the B2B route projects it. Money arrives as Decimal strings and
 *  is coerced at the fetch boundary. */
export interface QuoteRow {
  id: string;
  number: string | null;
  accountId: string | null;
  customerId: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  validUntil: string | null;
  customerNote: string | null;
  stage: QuoteStage;
  /** What is on the quote, in the order it was written. */
  lines: QuoteLine[];
  createdAt: string;
  updatedAt: string;
  account: { id: string; companyName: string } | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeQuote(raw: QuoteRow): QuoteRow {
  return {
    ...raw,
    subtotal: num(raw.subtotal),
    taxTotal: num(raw.taxTotal),
    total: num(raw.total),
    // Decimal columns arrive as strings, the same as the totals above. A line
    // left uncoerced renders "40" times "25.20" as string concatenation the
    // moment anything does arithmetic on it.
    lines: (raw.lines ?? []).map((line) => ({
      ...line,
      quantity: num(line.quantity),
      unitPrice: num(line.unitPrice),
      lineTotal: num(line.lineTotal),
    })),
  };
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** What a quote's stage MEANS, as a semantic tone — the stored `stageType`, not
 *  the tenant's label, which is what we color by. The label itself is shown. */
export function quoteTone(stageType: string): Tone {
  switch (stageType) {
    case 'committed':
      return 'success'; // accepted
    case 'void':
      return 'neutral'; // declined / expired
    default:
      return 'info'; // draft — awaiting a decision
  }
}

/**
 * The business a quote belongs to, or null when there is not one.
 *
 * Fourteen of the sixteen quotes on this machine have no business on them at
 * all — a shop rings, you price it up, and nobody has opened a trade account
 * yet. The list deliberately shows those (issue 763), so "the business" is
 * genuinely absent on most rows and has to be able to say so.
 */
export function quoteBusiness(row: QuoteRow): string | null {
  return row.account?.companyName ?? null;
}

/**
 * The person who asked, or null. Their email stands in when that is the only
 * thing we hold, because an address still tells her who it was.
 */
export function quoteAsker(row: QuoteRow): string | null {
  if (!row.customer) return null;
  const person = [row.customer.firstName, row.customer.lastName].filter(Boolean).join(' ').trim();
  if (person !== '') return person;
  return row.customer.email ?? null;
}

/**
 * Who the quote is for, in ONE line — the business if there is one, else the
 * person. Null when neither is on it.
 *
 * It used to fall back to the words "Unknown business", which claims there IS a
 * business and that we have lost track of which. Both halves were wrong: most
 * quotes have no business on them by design, and the fallback printed under a
 * column headed "Business" made a person's name look like a company's.
 * [[feedback_never_present_absence_as_measurement]]
 */
export function quoteParty(row: QuoteRow): string | null {
  return quoteBusiness(row) ?? quoteAsker(row);
}

/**
 * The three answers a quote can be sitting in, and what to call each one.
 *
 * Keyed on the stored `stageType`, NOT on the stage's name: stages are the
 * tenant's to rename, and a chip that stops matching when someone edits their
 * own workflow is a chip that quietly returns nothing. One chip gathers several
 * stages — "Not answered" is Draft, Submitted, Under Review and Quoted at once —
 * so the words say what is true of all of them rather than naming a stage the
 * table does not print.
 */
export const QUOTE_STATES = [
  { value: 'all', label: 'All', state: undefined },
  { value: 'open', label: 'Not answered', state: 'open' },
  { value: 'accepted', label: 'Accepted', state: 'accepted' },
  { value: 'closed', label: 'Closed', state: 'closed' },
] as const;

export type QuoteStateValue = (typeof QUOTE_STATES)[number]['value'];

/**
 * What to try when nothing matched, naming ONLY what is actually narrowing the
 * list. The wholesale orders list next door said "Try a different word" to a
 * person who had not typed one, which sends her hunting for a search box she
 * never used. Same shape as `emptyAdvice` on the orders chips.
 */
export function quoteEmptyAdvice(search: string, filterLabel: string | null): string {
  const parts: string[] = [];
  if (search) {
    parts.push('Try part of a quote number, or the business or person who asked.');
  }
  if (filterLabel) {
    parts.push(`The “${filterLabel}” filter is on. Switch back to All to see the rest.`);
  }
  return parts.join(' ');
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return formatAmount(amount, currency);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Whether a quote's validity window has already passed. */
export function isExpired(row: QuoteRow): boolean {
  return row.validUntil != null && new Date(row.validUntil).getTime() < Date.now();
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export interface QuoteListQuery {
  accountId?: string;
  /** Quote number, the business that asked, or the person who asked. */
  q?: string;
  /** One of the three buckets in QUOTE_STATES. Undefined means all of them. */
  state?: 'open' | 'accepted' | 'closed';
  take: number;
  skip: number;
}

export function useQuotes(query: QuoteListQuery) {
  return useQuery({
    queryKey: ['b2b', 'quotes', 'list', query],
    queryFn: () =>
      api
        .list<QuoteRow>('/v1/b2b/quotes', {
          ...(query.accountId ? { account_id: query.accountId } : {}),
          ...(query.q ? { q: query.q } : {}),
          ...(query.state ? { state: query.state } : {}),
          take: query.take,
          skip: query.skip,
        })
        .then((result) => ({
          items: result.items.map(normalizeQuote),
          total: result.total,
        })),
    placeholderData: (previous) => previous,
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['b2b', 'quotes', id],
    queryFn: () => api.get<QuoteRow>(`/v1/b2b/quotes/${id}`).then(normalizeQuote),
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}
