'use client';

// ══════════════════════════════════════════════════════════════════════════
// SIGNING OFF WHAT GETS SPENT (docs/146 Phase 8.5)
//
// Two halves. The RULES say when an order needs a second pair of eyes — over an
// amount, with a supplier, at a location. The QUEUE is the orders currently
// waiting on one, and it is a queue in the real sense: its failure mode is not a
// wrong decision, it is no decision, so `waitingDays` rides on every row.
//
// The third thing here is rescheduling, which belongs with approvals only
// because it is the other write against an order that has already been placed.
// It exists because the buying screens had no way at all to record "they rang to
// say it will be a fortnight" — the order simply stayed permanently overdue.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';
import { purchaseOrderKeys } from './purchase-orders-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface PoApprovalRule {
  id: string;
  name: string;
  /** Null = every supplier. */
  supplierId: string | null;
  supplierName: string | null;
  /** Null = every location. */
  warehouseId: string | null;
  warehouseName: string | null;
  minAmountCents: number;
  /** A named person must sign. Null = anybody with the role below. */
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  requiredRole: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PoApproval {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  supplierName: string | null;
  ruleId: string | null;
  ruleName: string | null;
  status: string;
  /** The order total AT REQUEST TIME. Editing the order afterwards does not
   *  change what was signed for. */
  amountCents: number;
  currency: string;
  requestedByUserId: string | null;
  requestedByName: string | null;
  requestedAt: string;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  /** The role the RULE routes to. Carried onto the request so the order's own
   *  pane and the queue can say who has to sign, rather than falling back to
   *  "anybody who can approve spending" over a rule that says the owner. */
  requiredRole: string | null;
  decidedByUserId: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  note: string | null;
  /** Only while it is still waiting — a decided request's age is not "how long
   *  it has been waiting", and reporting one would flatter the queue. */
  waitingDays: number | null;
}

export interface ApprovalQueue {
  items: PoApproval[];
  total: number;
  /** Everything still waiting, whatever this view is filtered to. */
  pending: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const approvalKeys = {
  all: ['inventory', 'po-approvals'] as const,
  rules: (includeInactive: boolean) => [...approvalKeys.all, 'rules', includeInactive] as const,
  queue: (status: string) => [...approvalKeys.all, 'queue', status] as const,
  forOrder: (purchaseOrderId: string) => [...approvalKeys.all, 'order', purchaseOrderId] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function usePoApprovalRules(includeInactive = false) {
  return useQuery({
    queryKey: approvalKeys.rules(includeInactive),
    queryFn: () =>
      api.list<PoApprovalRule>('/v1/inventory/purchase-orders/approval-rules', {
        ...(includeInactive ? { include_inactive: true } : {}),
      }),
  });
}

export type QueueStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all';

/** `all` is passed THROUGH, not left out. Omitting `status` on this route means
 *  "the queue", which defaults to pending — the decided rows are history and a
 *  to-do list does not want them. Only naming an order used to reach the whole
 *  trail, so the route learned the word `all` for the case where no order is
 *  named. Sent back has had an "Everything" view since it shipped; this queue
 *  had four filters and no way to see them together. */
export function usePoApprovalQueue(status: QueueStatus) {
  return useQuery({
    queryKey: approvalKeys.queue(status),
    queryFn: () =>
      api.get<ApprovalQueue>('/v1/inventory/purchase-orders/approvals', { status, take: 200 }),
    placeholderData: (previous) => previous,
  });
}

/** Every request ever raised against one order — the trail, in order. Shown on
 *  the order's own pane so the history of who asked and who signed is not a
 *  separate screen. */
export function useOrderApprovals(purchaseOrderId: string) {
  return useQuery({
    queryKey: approvalKeys.forOrder(purchaseOrderId),
    queryFn: () =>
      // No `status`: for ONE order the route returns the whole trail, which is
      // the point of a trail — the refusals. It used to pass `status: 'pending'`
      // directly under a comment saying "every status", so a buyer whose order
      // had been sent back opened it to an ordinary draft with no sign anything
      // had happened. [[feedback_a_fix_leaves_its_neighbour_behind]]
      api.get<ApprovalQueue>('/v1/inventory/purchase-orders/approvals', {
        purchase_order_id: purchaseOrderId,
      }),
    enabled: purchaseOrderId !== '' && purchaseOrderId !== 'new',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

function useInvalidateApprovals() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    // A decision changes the ORDER's status too, so the buying screens have to
    // hear about it — otherwise an approved order still reads "waiting".
    void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
  };
}

export interface PoApprovalRuleInput {
  name: string;
  supplierId?: string | null;
  warehouseId?: string | null;
  minAmountCents?: number;
  requiredApproverUserId?: string | null;
  requiredRole?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function useCreatePoApprovalRule() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (input: PoApprovalRuleInput) =>
      api.post<PoApprovalRule>('/v1/inventory/purchase-orders/approval-rules', input),
    onSuccess: invalidate,
  });
}

export function useUpdatePoApprovalRule() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PoApprovalRuleInput> }) =>
      api.patch<PoApprovalRule>(`/v1/inventory/purchase-orders/approval-rules/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeletePoApprovalRule() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/inventory/purchase-orders/approval-rules/${id}`),
    onSuccess: invalidate,
  });
}

export function useDecidePoApproval() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'approved' | 'rejected';
      note?: string;
    }) =>
      api.post(`/v1/inventory/purchase-orders/approvals/${id}/decide`, {
        decision,
        ...(note ? { note } : {}),
      }),
    onSuccess: invalidate,
  });
}

export function useCancelPoApproval() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/v1/inventory/purchase-orders/approvals/${id}/cancel`, {}),
    onSuccess: invalidate,
  });
}

/** Record a new arrival date on an order already placed. Clears the overdue flag
 *  so a broken NEW promise is heard. */
export function useRescheduleArrival() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: ({
      id,
      expectedArrivalAt,
      note,
    }: {
      id: string;
      expectedArrivalAt: string | null;
      note?: string;
    }) =>
      api.post(`/v1/inventory/purchase-orders/${id}/reschedule`, {
        expectedArrivalAt,
        ...(note ? { note } : {}),
      }),
    onSuccess: invalidate,
  });
}

/* ── Saying it out loud ─────────────────────────────────────────────────── */

export function approvalStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting for sign-off';
    case 'approved':
      return 'Signed off';
    case 'rejected':
      return 'Turned down';
    case 'cancelled':
      return 'Withdrawn';
    default:
      return status;
  }
}

export function approvalStatusTone(status: string): Tone {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** How long something has sat unsigned, as a color. A queue that is never
 *  worked is the failure mode, so the color escalates on TIME, not on money. */
export function waitingTone(days: number | null): Tone {
  if (days === null) return 'neutral';
  if (days >= 5) return 'danger';
  if (days >= 2) return 'warning';
  return 'info';
}

/** Who a rule sends an order to, in one phrase. */
export function approverLabel(rule: {
  requiredApproverName: string | null;
  requiredRole: string | null;
}): string {
  if (rule.requiredApproverName) return rule.requiredApproverName;
  switch (rule.requiredRole) {
    case 'owner':
      return 'The owner';
    case 'admin':
      return 'Any administrator';
    case 'editor':
      return 'Anyone who can edit';
    default:
      return 'Anyone who can edit buying';
  }
}

/** What a rule covers, in one phrase, for the list. */
export function ruleScopeLabel(rule: {
  supplierName: string | null;
  warehouseName: string | null;
}): string {
  if (rule.supplierName && rule.warehouseName) {
    return `${rule.supplierName} · ${rule.warehouseName}`;
  }
  if (rule.supplierName) return rule.supplierName;
  if (rule.warehouseName) return rule.warehouseName;
  return 'Every supplier and location';
}
