'use client';

// Hand-picked lists (docs/144 §10) — a segment whose members were CHOSEN, not
// derived. The evaluator leaves these alone entirely, so adding and removing is
// the only way membership changes, and the history is the only record of it.

import { useMutation, useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Customer } from './customers-data';
import { segmentKeys } from './segments-types';
import { useInvalidateSegments } from './segments-mutations';

/** One join or departure. Kept even after the membership row is gone, which is
 *  the whole reason this exists — "who came off this list" is unanswerable from
 *  current membership alone. */
export interface MembershipEvent {
  id: string;
  segmentId: string;
  customerId: string;
  kind: 'entered' | 'exited';
  source: 'rule' | 'manual' | 'automation' | 'import';
  actorId: string | null;
  occurredAt: string;
  customer: Customer;
}

export const MEMBERSHIP_SOURCE_LABEL: Record<MembershipEvent['source'], string> = {
  rule: 'The rules',
  manual: 'Added by hand',
  automation: 'An automation',
  import: 'An import',
};

export function useSegmentHistory(id: string, kind?: 'entered' | 'exited') {
  return useQuery({
    queryKey: [...segmentKeys.history(id), kind ?? null],
    queryFn: () =>
      api.list<MembershipEvent>(`/v1/crm/segments/${id}/history`, kind ? { kind } : {}),
    enabled: id !== 'new' && id !== '',
  });
}

export function useAddListMembers(id: string) {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: (customerIds: string[]) =>
      api.post<{ added: number; alreadyOn: number }>(`/v1/crm/segments/${id}/members`, {
        customerIds,
      }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useRemoveListMembers(id: string) {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: (customerIds: string[]) =>
      api.post<{ removed: number }>(`/v1/crm/segments/${id}/members/remove`, { customerIds }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}
