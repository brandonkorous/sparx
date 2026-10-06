'use client';

// ══════════════════════════════════════════════════════════════════════════
// A TRADE ACCOUNT'S STATEMENT
//
// What the account owed at the start of a period, every invoice, payment and
// write-off in it (each with the buyer's own PO number, which is what their
// accounts department reconciles against), what it owes at the end, and how
// late. Worked out by api-rest from the bills already on the account:
//
//   GET  /v1/b2b/accounts/:id/statement?from=&to=        the statement
//   GET  /v1/b2b/accounts/:id/statement/print?from=&to=  the page to print
//   POST /v1/b2b/accounts/:id/statement/send             email it to them
//
// Keyed under the account (['b2b','accounts', id, 'statement', …]) so anything
// that refreshes the account refreshes its statement with it.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { todayIso } from '../../lib/today';
import { accountKeys } from './accounts-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type StatementRowKind = 'invoice' | 'payment' | 'refund' | 'write_off';
export type StatementAgingKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

/** One thing that happened on the account. Mirrors @wizeworks/crm `StatementRow`. */
export interface StatementRow {
  kind: StatementRowKind;
  at: string;
  documentId: string;
  documentNumber: string | null;
  poNumber: string | null;
  dueAt: string | null;
  description: string;
  chargeCents: number;
  creditCents: number;
  balanceCents: number;
}

/** An invoice still open at the end of the period. */
export interface StatementOpenItem {
  documentId: string;
  number: string | null;
  poNumber: string | null;
  issuedAt: string;
  dueAt: string | null;
  totalCents: number;
  openCents: number;
  daysLate: number;
  bucket: StatementAgingKey;
}

export interface StatementAgingBucket {
  key: StatementAgingKey;
  label: string;
  count: number;
  cents: number;
}

/** Who "Email it to them" reaches, and why each address. */
export interface StatementRecipient {
  email: string;
  name: string | null;
  reason: 'main_contact' | 'invoice_address' | 'contact';
}

export interface AccountStatement {
  account: {
    id: string;
    companyName: string;
    billingAddress: string[];
    paymentTerms: string | null;
    paymentTermsWords: string | null;
    creditLimitCents: number;
    status: string;
  };
  period: { from: string; to: string };
  currency: string;
  generatedAt: string;
  issuerPropertyId: string | null;
  openingCents: number;
  chargesCents: number;
  creditsCents: number;
  closingCents: number;
  dueNowCents: number;
  pastDueCents: number;
  rows: StatementRow[];
  openItems: StatementOpenItem[];
  aging: StatementAgingBucket[];
  recipients: StatementRecipient[];
}

/* ── The period ─────────────────────────────────────────────────────────── */

export type StatementPreset = 'this_month' | 'last_month' | 'last_90' | 'this_year' | 'custom';

export const STATEMENT_PRESETS: { value: StatementPreset; label: string }[] = [
  { value: 'this_month', label: 'This month so far' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90', label: 'The last 90 days' },
  { value: 'this_year', label: 'This year so far' },
  { value: 'custom', label: 'Pick the dates' },
];

/** What is asked of the server. A blank end means "today", decided by the
 *  server on the BUSINESS's calendar, so a reader a time zone ahead of the shop
 *  can never ask for a day the shop has not reached yet. */
export interface StatementPeriodQuery {
  from?: string;
  to?: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const day = (y: number, m: number, d: number): string => `${String(y)}-${pad(m + 1)}-${pad(d)}`;

/** The period a preset stands for, as of the reader's own today. */
export function presetPeriod(
  preset: Exclude<StatementPreset, 'custom'>,
  today: string = todayIso()
): StatementPeriodQuery {
  const [y = 1970, m = 1, d = 1] = today.split('-').map(Number);
  const month = m - 1;
  switch (preset) {
    case 'this_month':
      return {};
    case 'last_month': {
      const first = new Date(Date.UTC(y, month - 1, 1));
      const last = new Date(Date.UTC(y, month, 0));
      return {
        from: day(first.getUTCFullYear(), first.getUTCMonth(), 1),
        to: day(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
      };
    }
    case 'last_90': {
      const start = new Date(Date.UTC(y, month, d) - 89 * 86_400_000);
      return { from: day(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) };
    }
    case 'this_year':
      return { from: day(y, 0, 1) };
  }
}

/** A calendar day as it is read: "Oct 2, 2026". Dates on the wire are UTC
 *  days, so they are read in UTC or a reader west of it sees the day before. */
export function statementDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** How late an open invoice is, in words, and the state color that goes with
 *  it. Late is danger, due now is warning, not yet due is info. */
export function openItemState(item: Pick<StatementOpenItem, 'daysLate' | 'dueAt'>): {
  label: string;
  tone: 'danger' | 'warning' | 'info';
} {
  if (item.dueAt === null) return { label: 'Due on receipt', tone: 'warning' };
  if (item.daysLate > 0) {
    return {
      label: item.daysLate === 1 ? 'Late by 1 day' : `Late by ${String(item.daysLate)} days`,
      tone: 'danger',
    };
  }
  if (item.daysLate === 0) return { label: 'Due that day', tone: 'warning' };
  return { label: 'Not yet due', tone: 'info' };
}

/** Who an email reaches, as one phrase: "Renée Castañeda (renee@…)". */
export function recipientsText(recipients: readonly StatementRecipient[]): string {
  return recipients
    .map((r) => (r.name && r.reason !== 'invoice_address' ? `${r.name} (${r.email})` : r.email))
    .join(', ');
}

/** The print view's path, for `openServerHtml`. */
export function statementPrintPath(accountId: string, period: StatementPeriodQuery): string {
  const qs = new URLSearchParams();
  if (period.from) qs.set('from', period.from);
  if (period.to) qs.set('to', period.to);
  const query = qs.toString();
  return `/v1/b2b/accounts/${accountId}/statement/print${query ? `?${query}` : ''}`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const statementKeys = {
  of: (accountId: string, period: StatementPeriodQuery) =>
    [...accountKeys.detail(accountId), 'statement', period] as const,
};

export function useAccountStatement(accountId: string, period: StatementPeriodQuery | null) {
  return useQuery({
    queryKey: statementKeys.of(accountId, period ?? {}),
    queryFn: () =>
      api.get<AccountStatement>(`/v1/b2b/accounts/${accountId}/statement`, {
        ...(period?.from ? { from: period.from } : {}),
        ...(period?.to ? { to: period.to } : {}),
      }),
    enabled: accountId !== 'new' && period !== null,
    placeholderData: (previous) => previous,
  });
}

export function useSendStatement(accountId: string) {
  return useMutation({
    mutationFn: (period: StatementPeriodQuery) =>
      api.post<{ sentTo: string[] }>(`/v1/b2b/accounts/${accountId}/statement/send`, period),
  });
}
