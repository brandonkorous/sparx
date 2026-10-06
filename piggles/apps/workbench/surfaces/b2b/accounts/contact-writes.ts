'use client';

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../../lib/api/client';
import { customerKeys } from '../../crm/customers-data';
import { useInvalidateAccounts, type ContactRole } from '../accounts-data';

// Adding or removing a member writes on the CUSTOMER too (issue 744), so a
// customer pane open beside this one has to hear about it.
export function useInvalidateMembership() {
  const queryClient = useQueryClient();
  const invalidateAccounts = useInvalidateAccounts();
  return (accountId: string) => {
    invalidateAccounts(accountId);
    // The whole root: the pointer shows on the customer's rail, in the list's
    // company column, and in every filtered window of it.
    void queryClient.invalidateQueries({ queryKey: customerKeys.all });
  };
}

// A contact's approver role decides who signs held orders (sparx persona issue 087),
// so a change here reaches Approvals. Literal keys: approvals-data imports this
// layer, so importing it back would be a cycle.
function useInvalidateSignOff() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'approval-rules'] });
    void queryClient.invalidateQueries({ queryKey: ['b2b', 'approval-queue'] });
  };
}

export function useAddContact(id: string) {
  const invalidate = useInvalidateMembership();
  const invalidateSignOff = useInvalidateSignOff();
  return useMutation({
    mutationFn: (input: { customerId: string; role: ContactRole }) =>
      api.post(`/v1/crm/b2b-accounts/${id}/contacts`, input),
    onSuccess: () => {
      invalidate(id);
      invalidateSignOff();
    },
  });
}

export function useUpdateContact(id: string) {
  const invalidate = useInvalidateMembership();
  const invalidateSignOff = useInvalidateSignOff();
  return useMutation({
    mutationFn: (input: { contactId: string; role?: ContactRole; isActive?: boolean }) =>
      api.patch(`/v1/crm/b2b-accounts/${id}/contacts/${input.contactId}`, {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      }),
    onSuccess: () => {
      invalidate(id);
      invalidateSignOff();
    },
  });
}
