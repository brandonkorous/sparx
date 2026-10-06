'use client';

import { useMutation } from '@wizeworks/query';
import { api } from '../../../lib/api/client';
import type { Automation, AutomationCreateInput, AutomationUpdateInput } from './wire-types';
import { useInvalidateAutomations } from './queries';

/* ── Mutations ──────────────────────────────────────────────────────────── */

export function useCreateAutomation() {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (input: AutomationCreateInput) => api.post<Automation>('/v1/automations', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (patch: AutomationUpdateInput) =>
      api.patch<Automation>(`/v1/automations/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: () => api.delete(`/v1/automations/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** "Duplicate to edit" — fork an editable copy (the only way to adapt a locked
 *  or system rule). Optionally names the copy. */
export function useCloneAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (name?: string) =>
      api.post<Automation>(`/v1/automations/${id}/clone`, name ? { name } : {}),
    onSuccess: (clone) => {
      invalidate(clone.id);
    },
  });
}

export function useSetAutomationStatus(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (status: 'draft' | 'active' | 'paused') =>
      api.post<Automation>(`/v1/automations/${id}/status`, { status }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function usePublishAutomation(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (note?: string) =>
      api.post<Automation>(`/v1/automations/${id}/publish`, note ? { note } : {}),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDiscardDraft(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: () => api.post<Automation>(`/v1/automations/${id}/discard-draft`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Switch a rule we set up to our newer version. The server keeps its name and
 *  on/off, and keeps the business's current version in the history. */
export function useTakePlatformVersion(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: () => api.post<Automation>(`/v1/automations/${id}/take-platform-version`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useRestoreVersion(id: string) {
  const invalidate = useInvalidateAutomations();
  return useMutation({
    mutationFn: (version: number) =>
      api.post<Automation>(`/v1/automations/${id}/restore`, { version }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}
