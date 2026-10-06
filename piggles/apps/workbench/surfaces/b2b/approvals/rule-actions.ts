'use client';

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../../lib/confirm';
import { useDeleteRule, useUpdateRule } from './rules-data';
import { approvalErrorMessage, type ApprovalRule } from '../approvals-data';
import { signOffChoice } from '../../../components/approver-choice';

// Changing who signs a limit, and switching it on or off, each saying so on failure.
export function useRuleRowActions() {
  const toast = useToast();
  const updateRule = useUpdateRule();
  const changeApprover = (rule: ApprovalRule, next: string) => {
    updateRule.mutate(
      // Both halves, always (see onCreate).
      { id: rule.id, ...signOffChoice(next) },
      {
        onError: (error) => {
          toast.add({
            title: 'Could not change who signs this off',
            description: approvalErrorMessage(
              error,
              'The rule is unchanged, so the same person signs it off as before.'
            ),
            type: 'error',
          });
        },
      }
    );
  };
  const toggleRule = (rule: ApprovalRule, next: boolean) => {
    // A switch that springs back and says nothing is the same
    // screen as a switch that never moved. The list is only
    // invalidated on success, so a failure reverts it silently.
    updateRule.mutate(
      { id: rule.id, isActive: next },
      {
        onError: (error) => {
          toast.add({
            title: next ? 'Could not switch that limit on' : 'Could not switch that limit off',
            description: approvalErrorMessage(
              error,
              'The limit is unchanged, so orders are still being held the way they were.'
            ),
            type: 'error',
          });
        },
      }
    );
  };
  return { updateRule, changeApprover, toggleRule };
}

// Removing a limit cannot be undone, so it says what stops happening rather than
// only asking twice. [[feedback_destructive_actions_confirm]]
export function useRemoveRule() {
  const toast = useToast();
  const confirm = useConfirm();
  const deleteRule = useDeleteRule();
  const removeRule = async (rule: ApprovalRule) => {
    const ok = await confirm({
      title: `Remove the limit over ${rule.minAmountFormatted}?`,
      description:
        rule.accountName === null
          ? 'No order will be held for sign-off on size alone. Every wholesale order goes straight ' +
            'through, however large.'
          : `No order from ${rule.accountName} will be held for sign-off again, however large.`,
      confirmLabel: 'Remove the limit',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    deleteRule.mutate(rule.id, {
      onSuccess: () => {
        toast.add({ title: 'Limit removed', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove that limit',
          description: approvalErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return { removeRule, deleteRule };
}
