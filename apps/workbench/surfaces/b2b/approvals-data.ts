'use client';

// ══════════════════════════════════════════════════════════════════════════
// APPROVALS — orders held for someone to say yes.
//
// When a trade account places an order over a threshold you've set, checkout
// holds it instead of placing it, and it waits here for a member of staff to
// approve or reject it. Approving places the order (and invoices it, if the
// account is on terms); rejecting cancels it.
//
// This surface has two halves: the QUEUE of held orders, and the RULES that
// decide when an order gets held in the first place.
//
//   ['b2b','approval-queue',{…}]   the held orders
//   ['b2b','approval-rules']       the thresholds
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface QueueItem {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  companyId: string | null;
  companyName: string | null;
}

export interface ApprovalRule {
  id: string;
  accountId: string | null;
  accountName: string | null;
  propertyId: string | null;
  minAmountCents: number;
  minAmountFormatted: string;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  isActive: boolean;
  createdAt: string;
}

export const approvalKeys = {
  queue: ['b2b', 'approval-queue'] as const,
  rules: ['b2b', 'approval-rules'] as const,
};

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function queueBuyer(item: QueueItem): string {
  return item.companyName ?? item.customerName ?? item.customerEmail ?? 'A trade customer';
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useApprovalQueue(q: string) {
  return useQuery({
    queryKey: [...approvalKeys.queue, { q }],
    queryFn: () =>
      api.list<QueueItem>('/v1/b2b/approval-queue', {
        ...(q ? { q } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useApprovalRules() {
  return useQuery({
    queryKey: approvalKeys.rules,
    queryFn: () =>
      api.get<{ rules: ApprovalRule[] }>('/v1/b2b/approval-rules').then((r) => r.rules),
  });
}

/** Trade accounts, named, for scoping a rule to one business. */
export function useApprovalAccountChoices() {
  return useQuery({
    queryKey: ['b2b', 'approval-rules', 'account-choices'],
    queryFn: () => api.list<{ id: string; companyName: string }>('/v1/b2b/accounts', { take: 250 }),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidateApprovals() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: approvalKeys.queue });
    // Approving invoices net-terms orders and can move an account's credit.
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'accounts'] });
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'orders'] });
  };
}

/* ── Queue mutations ────────────────────────────────────────────────────── */

export function useApproveOrder() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (input: { orderId: string; reason?: string }) =>
      api.post(
        `/v1/b2b/approval-queue/${input.orderId}/approve`,
        input.reason ? { reason: input.reason } : {}
      ),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRejectOrder() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (input: { orderId: string; reason?: string }) =>
      api.post(
        `/v1/b2b/approval-queue/${input.orderId}/reject`,
        input.reason ? { reason: input.reason } : {}
      ),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Rule mutations ─────────────────────────────────────────────────────── */

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: approvalKeys.rules });
}

export interface RuleInput {
  accountId: string | null;
  minAmountCents: number;
}

export function useCreateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: RuleInput) =>
      api.post('/v1/b2b/approval-rules', {
        accountId: input.accountId,
        minAmountCents: input.minAmountCents,
      }),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useUpdateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: { id: string; minAmountCents?: number; isActive?: boolean }) =>
      api.patch(`/v1/b2b/approval-rules/${input.id}`, {
        ...(input.minAmountCents !== undefined ? { minAmountCents: input.minAmountCents } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      }),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useDeleteRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/b2b/approval-rules/${id}`),
    onSuccess: () => {
      void invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function approvalErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
