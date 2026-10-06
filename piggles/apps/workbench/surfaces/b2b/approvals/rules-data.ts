'use client';

import { useMutation, useQueryClient, type QueryClient } from '@wizeworks/query';
import { api } from '../../../lib/api/client';
import type { SignOffSide } from '../sign-off-words';
import { approvalKeys } from '../approvals-data';

/* ── Rule mutations ─────────────────────────────────────────────────────── */

// What a rule change refreshes: the rules AND the held orders, since who an order
// waits on is worked out from the rules (sparx persona issue 087). The queue key
// also covers each order pane's notice (`heldOrderKey`).
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
