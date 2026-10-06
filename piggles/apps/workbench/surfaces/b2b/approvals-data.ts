'use client';

// APPROVALS: wholesale orders held over a limit, waiting for a yes. Approving
// places (and on terms invoices) the order; rejecting cancels it. Two halves:
// the QUEUE ['b2b','approval-queue',{…}] and the RULES ['b2b','approval-rules'].

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type { QueueHoldReason } from './approval-hold-notice';
import type { AccountApprover, ApprovedStock, SignOff, SignOffSide } from './sign-off-words';
import { accountKeys, type AccountContact } from './accounts-data';
import { formatCentsAmount } from '../../lib/money-format';

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
  /** Why it is waiting. Empty on an order held before reasons were kept. */
  holdReasons: QueueHoldReason[];
  /** Who it is waiting on: the business's team, the account's own approvers,
   *  or both, and who has already signed (sparx persona issue 087). */
  signOff: SignOff;
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
  /** Who signs what this limit holds: the business's team, or the account's
   *  own approvers on the site (sparx persona issue 087). */
  signOffBy: SignOffSide;
  /** For a limit on ONE account, who there can approve, oldest first. Empty
   *  means nobody can, so the team signs instead. Null on an every-account
   *  limit, where it differs account by account. */
  accountApprovers: AccountApprover[] | null;
  isActive: boolean;
  createdAt: string;
}

export const approvalKeys = {
  queue: ['b2b', 'approval-queue'] as const,
  rules: ['b2b', 'approval-rules'] as const,
};

export function formatCents(cents: number, currency = 'USD'): string {
  return formatCentsAmount(cents, currency);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A signature's day, short ("Oct 3"): the queue says when, not to the minute. */
export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

// The order the pane shows, as the queue sees it, searched by number (sparx persona
// issue 087); only the exact order counts. Shares the queue's key, so an approval
// made under Approvals refreshes it.
export function heldOrderKey(orderNumber: string) {
  return [...approvalKeys.queue, { q: orderNumber }] as const;
}

export function useHeldOrderSignOff(orderNumber: string, enabled: boolean) {
  const query = useQuery({
    queryKey: heldOrderKey(orderNumber),
    queryFn: () =>
      api.list<QueueItem>('/v1/b2b/approval-queue', {
        q: orderNumber,
        take: 100,
      }),
    enabled: enabled && orderNumber !== '',
  });
  const item = query.data?.items.find((one) => one.orderNumber === orderNumber) ?? null;
  return { query, item };
}

// Who at one account can approve orders, for the add-a-limit form. Read under the
// account pane's contacts key, so a role changed there shows here and back.
export function useAccountApproverChoices(accountId: string) {
  return useQuery({
    queryKey: accountKeys.contacts(accountId),
    queryFn: () =>
      api.list<AccountContact>(`/v1/crm/b2b-accounts/${accountId}/contacts`, { take: 100 }),
    enabled: accountId !== '',
    select: (page): AccountApprover[] =>
      page.items
        .filter((contact) => contact.isActive && contact.role === 'approver')
        .map((contact) => ({
          customerId: contact.customer.id,
          name: contactName(contact),
          email: contact.customer.email,
        })),
  });
}

/** A contact's name, or the email they ordered with when they never gave one. */
function contactName(contact: AccountContact): string {
  const person = [contact.customer.firstName, contact.customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (person !== '') return person;
  return contact.customer.email ?? 'Their approver';
}

/** Wholesale customers, named, for scoping a rule to one business. */
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
    // The held order's own pane (commerce `ORDERS_KEY`) says who it waits on
    // and whether it is placed, so a decision here has to reach it too.
    void queryClient.invalidateQueries({ queryKey: ['commerce', 'orders'] });
  };
}

/* ── Queue mutations ────────────────────────────────────────────────────── */

/** What the business's Approve did. `placed` when it was the last signature
 *  the order needed; still `pending_approval` when the account has yet to say
 *  yes, with `waitingOn` naming them (sparx persona issue 087). */
export interface ApproveResult {
  id: string;
  orderNumber: string;
  status: string;
  waitingOn?: SignOffSide[];
  /** Set when placing it took stock that was not there or was held for
   *  another order; null or absent when every unit was in stock, and while it
   *  still waits for somebody. */
  stock?: ApprovedStock | null;
}

export function useApproveOrder() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (input: { orderId: string; reason?: string }) =>
      api.post<ApproveResult>(
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

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function approvalErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
