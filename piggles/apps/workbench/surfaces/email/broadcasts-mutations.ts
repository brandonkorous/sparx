'use client';

// Every write to a broadcast: create, edit, send, schedule, cancel.
//
// All five invalidate the ['email'] ROOT, so a change is reflected across every
// open email surface at once — the list, the composer, and the review.

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { emailKeys, type Broadcast } from './broadcasts-data';

export function useInvalidateBroadcasts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: emailKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: emailKeys.broadcast(id) });
  };
}

/* ── Write inputs ─────────────────────────────────────────────────────────── */

export interface BroadcastCreateInput {
  name: string;
  subject: string;
  preheader?: string;
  segmentId?: string;
  builderEmailId?: string;
}

export interface BroadcastUpdateInput {
  name?: string;
  subject?: string;
  preheader?: string | null;
  segmentId?: string | null;
  builderEmailId?: string | null;
}

/* ── Mutations (id-agnostic, so one caller can create-or-update) ──────────── */

export function useCreateBroadcast() {
  const invalidate = useInvalidateBroadcasts();
  return useMutation({
    mutationFn: (input: BroadcastCreateInput) => api.post<Broadcast>('/v1/email/broadcasts', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateBroadcast() {
  const invalidate = useInvalidateBroadcasts();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BroadcastUpdateInput }) =>
      api.patch<Broadcast>(`/v1/email/broadcasts/${id}`, patch),
    onSuccess: (updated) => {
      invalidate(updated.id);
    },
  });
}

export function useSendBroadcast() {
  const invalidate = useInvalidateBroadcasts();
  return useMutation({
    mutationFn: (id: string) => api.post<Broadcast>(`/v1/email/broadcasts/${id}/send`),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useScheduleBroadcast() {
  const invalidate = useInvalidateBroadcasts();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      api.post<Broadcast>(`/v1/email/broadcasts/${id}/schedule`, { scheduledAt }),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useCancelBroadcast() {
  const invalidate = useInvalidateBroadcasts();
  return useMutation({
    mutationFn: (id: string) => api.post<Broadcast>(`/v1/email/broadcasts/${id}/cancel`),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}
