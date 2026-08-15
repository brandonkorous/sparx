'use client';

// ══════════════════════════════════════════════════════════════════════════
// WHOLESALE INVOICES — what each trade account owes, and by when.
//
// A wholesale invoice is a net-terms receivable: a business bought on terms, so
// you invoice them and they pay within the agreed window. Under the hood it is a
// billing document scoped to a trade account; these routes project it as an
// "invoice" with the fields an accounts-receivable view needs — the amount, the
// balance still owed, the due date, and whether it's paid, overdue or written
// off.
//
//   ['b2b','invoices']              the root every read nests under
//   ['b2b','invoices','list',{…}]   the list window
//   ['b2b','invoices', id]          one invoice
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { PaymentTerms } from './accounts-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void';
export type PaidMethod = 'check' | 'ach' | 'wire' | 'credit_card' | 'other';

/** One invoice, as api-rest's B2B-AR projection returns it. */
export interface InvoiceRow {
  id: string;
  accountId: string | null;
  orderId: string | null;
  invoiceNumber: string;
  amountCents: number;
  balanceCents: number;
  status: InvoiceStatus;
  overdueDays: number | null;
  dueAt: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  account: { id: string; companyName: string; paymentTerms: PaymentTerms | null } | null;
  paidBy: { id: string; name: string | null; email: string } | null;
}

export const invoiceKeys = {
  all: ['b2b', 'invoices'] as const,
  detail: (id: string) => [...invoiceKeys.all, id] as const,
};

/* ── Display language ───────────────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** What an invoice is DOING, in a business owner's words, as a semantic tone. */
export function invoiceState(row: { status: InvoiceStatus; overdueDays: number | null }): {
  label: string;
  tone: Tone;
} {
  switch (row.status) {
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'partial':
      return { label: 'Part paid', tone: 'info' };
    case 'overdue':
      return {
        label:
          row.overdueDays && row.overdueDays > 0
            ? `Overdue ${String(row.overdueDays)} days`
            : 'Overdue',
        tone: 'danger',
      };
    case 'void':
      return { label: 'Written off', tone: 'neutral' };
    default:
      return { label: 'Owed', tone: 'warning' };
  }
}

export const PAID_METHOD_LABELS: Record<PaidMethod, string> = {
  check: 'Cheque',
  ach: 'Bank transfer (ACH)',
  wire: 'Wire',
  credit_card: 'Card',
  other: 'Other',
};

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export interface InvoiceListQuery {
  accountId?: string;
  status?: InvoiceStatus;
  take: number;
  skip: number;
}

export function useInvoices(query: InvoiceListQuery) {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'list', query],
    queryFn: () =>
      api.list<InvoiceRow>('/v1/b2b/invoices', {
        ...(query.accountId ? { account_id: query.accountId } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => api.get<InvoiceRow>(`/v1/b2b/invoices/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Trade accounts, named, for the create form's picker. Kept minimal so a new
 *  invoice can name the business without loading the full account view. */
export function useInvoiceAccountChoices() {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'account-choices'],
    queryFn: () => api.list<{ id: string; companyName: string }>('/v1/b2b/accounts', { take: 250 }),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateInvoices() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    // Marking an invoice paid can lift a credit hold on its account.
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'accounts'] });
    if (id) void queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface CreateInvoiceInput {
  accountId: string;
  invoiceNumber: string;
  amountCents: number;
  dueAt: string; // ISO datetime
  notes?: string | null;
}

export function useCreateInvoice() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      api.post<InvoiceRow>('/v1/b2b/invoices', {
        accountId: input.accountId,
        invoiceNumber: input.invoiceNumber,
        amountCents: input.amountCents,
        dueAt: input.dueAt,
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateInvoice(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (patch: { dueAt?: string; notes?: string }) =>
      api.patch(`/v1/b2b/invoices/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useMarkInvoicePaid(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: { paidMethod: PaidMethod; notes?: string }) =>
      api.post(`/v1/b2b/invoices/${id}/mark-paid`, {
        paidMethod: input.paidMethod,
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useWriteOffInvoice(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: { notes?: string }) =>
      api.post(`/v1/b2b/invoices/${id}/write-off`, input.notes ? { notes: input.notes } : {}),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function invoiceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
