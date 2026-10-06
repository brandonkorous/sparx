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

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@wizeworks/query';
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

/**
 * The order the pane is showing, as the approval queue sees it: who it waits
 * on. The order endpoint does not carry the sign-off, and the queue already
 * does, searched by number (sparx persona issue 087). The search matches parts
 * of numbers too, so only the exact order counts. Shares the queue's key, so an
 * approval made under Approvals refreshes it.
 */
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

/**
 * Who at one account can approve orders, for the add-a-limit form: the rules
 * list names them only for limits that already exist. Read from the account's
 * own contacts, under the account pane's key, so a role changed there shows
 * here and the other way round.
 */
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

/* ── Rule mutations ─────────────────────────────────────────────────────── */

/**
 * What a rule change has to refresh: the rules, AND the held orders.
 *
 * Who a held order waits on is worked out from the rules on every read of the
 * queue (sparx persona issue 087). Doty set Wasatch's limit to its own
 * approvers, the row saved and said so, and the queue above it still offered
 * Approve on O-000014 until she pressed refresh: the server would have refused
 * that Approve. The queue key also covers each order pane's held-order notice
 * (`heldOrderKey`), so one invalidation reaches both.
 */
export function invalidateAfterRuleChange(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: approvalKeys.rules }),
    queryClient.invalidateQueries({ queryKey: approvalKeys.queue }),
  ]);
}

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return () => invalidateAfterRuleChange(queryClient);
}

export interface RuleInput {
  accountId: string | null;
  minAmountCents: number;
  /** Who signs: the business's team, or the account's own approvers. */
  signOffBy: SignOffSide;
  /** The one person who has to sign, or null for anyone who can approve.
   *  Always null when the account signs; the server refuses both at once. */
  requiredApproverUserId: string | null;
}

export function useCreateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: RuleInput) =>
      api.post('/v1/b2b/approval-rules', {
        accountId: input.accountId,
        minAmountCents: input.minAmountCents,
        signOffBy: input.signOffBy,
        requiredApproverUserId: input.requiredApproverUserId,
      }),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useUpdateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: {
      id: string;
      minAmountCents?: number;
      isActive?: boolean;
      signOffBy?: SignOffSide;
      requiredApproverUserId?: string | null;
    }) =>
      api.patch(`/v1/b2b/approval-rules/${input.id}`, {
        ...(input.minAmountCents !== undefined ? { minAmountCents: input.minAmountCents } : {}),
        ...(input.signOffBy !== undefined ? { signOffBy: input.signOffBy } : {}),
        ...(input.requiredApproverUserId !== undefined
          ? { requiredApproverUserId: input.requiredApproverUserId }
          : {}),
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
  return apiErrorMessage(error, fallback);
}
