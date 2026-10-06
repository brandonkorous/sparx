'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useCreateRule } from './rules-data';
import {
  approvalErrorMessage,
  useAccountApproverChoices,
  useApprovalAccountChoices,
} from '../approvals-data';
import { ANY_APPROVER, signOffChoice } from '../../../components/approver-choice';
import { ruleSignOffNote, type SignOffRule } from '../sign-off-words';

// The add-a-rule form's values, kept while the form is closed and reopened.
export function useRuleDraft(setAdding: (next: boolean) => void) {
  const toast = useToast();
  const createRule = useCreateRule();
  const [amount, setAmount] = useState(1000);
  const [accountId, setAccountId] = useState('');
  const [approver, setApprover] = useState(ANY_APPROVER);
  const signer = useDraftSigner(accountId, approver);

  const onCreate = () => {
    createRule.mutate(
      {
        accountId: accountId === '' ? null : accountId,
        minAmountCents: Math.round(amount * 100),
        // Both halves, always: the server refuses the customer signing beside
        // a named teammate, and a half left out would keep what it was.
        ...signOffChoice(approver),
      },
      {
        onSuccess: () => {
          setAdding(false);
          setAmount(1000);
          setAccountId('');
          setApprover(ANY_APPROVER);
          toast.add({ title: 'Rule added', type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that rule',
            description: approvalErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return {
    amount,
    setAmount,
    accountId,
    setAccountId,
    approver,
    setApprover,
    onCreate,
    createRule,
    ...signer,
  };
}

// Who signs the new limit, as the who-signs words read a saved one.
function useDraftSigner(accountId: string, approver: string) {
  const accountsQuery = useApprovalAccountChoices();
  // Who at the chosen customer can approve, so "their approvers" can name them
  // before the limit is saved (sparx persona issue 087).
  const chosenApprovers = useAccountApproverChoices(accountId);

  const accountItems = useMemo(
    () => [
      { value: '', label: 'Every customer' },
      ...(accountsQuery.data?.items ?? []).map((account) => ({
        value: account.id,
        label: account.companyName,
      })),
    ],
    [accountsQuery.data]
  );

  // The new limit, as the who-signs words read a saved one.
  const draftSigner: SignOffRule = {
    signOffBy: signOffChoice(approver).signOffBy,
    accountName:
      accountId === ''
        ? null
        : (accountItems.find((item) => item.value === accountId)?.label ?? 'This customer'),
    accountApprovers: accountId === '' ? null : (chosenApprovers.data ?? null),
  };
  const draftNote = ruleSignOffNote(draftSigner);
  return { accountItems, draftSigner, draftNote };
}

export type RuleDraft = ReturnType<typeof useRuleDraft>;
