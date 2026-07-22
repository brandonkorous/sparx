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

import { useQuery } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The workflow stage a quote sits on. `stageType` is the lifecycle bucket the
 *  tone derives from; `name` is the tenant's own label for it. */
export interface QuoteStage {
  id: string;
  name: string;
  customerLabel: string | null;
  stageType: string; // draft | committed | void
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
  };
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** What a quote's stage MEANS, as a semantic tone — the stored `stageType`, not
 *  the tenant's label, which is what we colour by. The label itself is shown. */
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

/** Who the quote is for, in one line — the business if there is one, else the
 *  person, else their email. */
export function quoteParty(row: QuoteRow): string {
  if (row.account) return row.account.companyName;
  if (row.customer) {
    const person = [row.customer.firstName, row.customer.lastName].filter(Boolean).join(' ').trim();
    if (person !== '') return person;
    return row.customer.email ?? 'Unknown business';
  }
  return 'Unknown business';
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
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
