'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PIPELINE DATA LAYER
//
// A pipeline is the set of STAGES a deal moves through — "New lead → Quoted →
// Won / Lost" — so a business can name its own way of winning work. A tenant can
// run several (one for new B2B accounts, one for renewals). This layer reads a
// pipeline with its stages and owns the stage editor's writes: add, rename,
// remove and reorder stages.
//
// Local wire types mirror the CRM's `CreatePipelineInput` / stage inputs (Zod in
// `@sparx/crm-schemas`), named here because that package is not a dependency; the
// server validates authoritatively.
//
//   ['crm','pipelines']              root
//   ['crm','pipelines','list',{…}]   one list window
//   ['crm','pipelines', id]          one pipeline with its stages
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type { StageType } from '@sparx/crm-schemas';
import { api } from '../../lib/api/client';

// `StageType` is the server's own enum (`@sparx/crm-schemas`). `PipelineInput` /
// `StageInput` below stay narrow local write payloads (the `DiscountInput` house
// pattern).
export type { StageType };

export interface PipelineStage {
  id: string;
  name: string;
  sortOrder: number;
  probability: string;
  stageType: StageType;
  color: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  slug: string;
  /** What this process moves (docs/144 §7.2) — `deal` or `ticket`. */
  objectKey: string;
  isDefault: boolean;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stages: PipelineStage[];
}

export interface PipelineListParams {
  q?: string;
  includeArchived?: boolean;
  /** Which object's processes to list. Omitted means sales deals — the meaning
   *  every caller had before pipelines became generic. `'all'` for both. */
  objectKey?: string;
}

export const pipelineKeys = {
  all: ['crm', 'pipelines'] as const,
  list: (params: PipelineListParams) => [...pipelineKeys.all, 'list', params] as const,
  detail: (id: string) => [...pipelineKeys.all, id] as const,
};

/**
 * What a stage can MEAN, per kind of process (docs/144 §7.2).
 *
 * Split by object rather than offered as one list: a sales pipeline with a
 * "Resolved" column is a mistake the server refuses, and offering it in the
 * dropdown first would just be a slower way of finding that out.
 */
export const DEAL_STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: 'open', label: 'In progress' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export const TICKET_STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: 'open', label: 'Still open' },
  { value: 'resolved', label: 'Sorted out' },
  { value: 'closed', label: 'Filed away' },
];

export function stageTypesFor(objectKey: string): { value: StageType; label: string }[] {
  return objectKey === 'ticket' ? TICKET_STAGE_TYPES : DEAL_STAGE_TYPES;
}

/** The sales vocabulary, kept under its old name so existing callers read
 *  unchanged. New code should ask `stageTypesFor` what this process uses. */
export const STAGE_TYPES = DEAL_STAGE_TYPES;

export function stageTypeMeta(type: string): {
  label: string;
  tone: 'success' | 'danger' | 'info';
} {
  if (type === 'won') return { label: 'Won', tone: 'success' };
  if (type === 'lost') return { label: 'Lost', tone: 'danger' };
  // A request that is sorted is a good outcome, same as a deal that is won —
  // and one that is merely filed away is neither good nor bad, which is what
  // makes it the earned kind of neutral.
  if (type === 'resolved') return { label: 'Sorted out', tone: 'success' };
  if (type === 'closed') return { label: 'Filed away', tone: 'info' };
  return { label: 'In progress', tone: 'info' };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function usePipelines(params: PipelineListParams = {}) {
  return useQuery({
    queryKey: pipelineKeys.list(params),
    queryFn: () =>
      api.list<Pipeline>('/v1/crm/pipelines', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.includeArchived ? { include_archived: true } : {}),
        ...(params.objectKey ? { object_key: params.objectKey } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: pipelineKeys.detail(id),
    queryFn: () => api.get<Pipeline>(`/v1/crm/pipelines/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidatePipelines() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: pipelineKeys.all });
    // Stages name a deal's position, so a stage change ripples into the deals list.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
    if (id) void queryClient.invalidateQueries({ queryKey: pipelineKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface PipelineInput {
  name: string;
  slug: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface StageInput {
  name: string;
  sortOrder: number;
  probability?: number;
  stageType?: StageType;
  color?: string | null;
}

export function useCreatePipeline() {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (input: PipelineInput) => api.post<Pipeline>('/v1/crm/pipelines', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdatePipeline(id: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (patch: Partial<PipelineInput>) =>
      api.patch<Pipeline>(`/v1/crm/pipelines/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Archive (soft-delete) a pipeline — admin-only server side. */
export function useArchivePipeline(id: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/pipelines/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useCreateStage(pipelineId: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (input: StageInput) =>
      api.post<PipelineStage>(`/v1/crm/pipelines/${pipelineId}/stages`, input),
    onSuccess: () => {
      invalidate(pipelineId);
    },
  });
}

export function useUpdateStage(pipelineId: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: ({ stageId, patch }: { stageId: string; patch: Partial<StageInput> }) =>
      api.patch<PipelineStage>(`/v1/crm/pipelines/${pipelineId}/stages/${stageId}`, patch),
    onSuccess: () => {
      invalidate(pipelineId);
    },
  });
}

/**
 * Remove a stage. When it still has deals, `reassignToStageId` is required and
 * the server moves them there first; with no deals it is ignored. The server
 * refuses to remove a pipeline's last stage.
 */
export function useDeleteStage(pipelineId: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: ({ stageId, reassignToStageId }: { stageId: string; reassignToStageId?: string }) =>
      api.delete<Pipeline>(
        `/v1/crm/pipelines/${pipelineId}/stages/${stageId}${
          reassignToStageId ? `?reassign_to_stage_id=${reassignToStageId}` : ''
        }`
      ),
    onSuccess: () => {
      invalidate(pipelineId);
    },
  });
}

/** Reorder every stage at once — the endpoint takes the desired final order and
 *  rewrites each stage's sort order in one transaction. */
export function useReorderStages(pipelineId: string) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: (stageIds: string[]) =>
      api.post<PipelineStage[]>(`/v1/crm/pipelines/${pipelineId}/stages/reorder`, { stageIds }),
    onSuccess: () => {
      invalidate(pipelineId);
    },
  });
}

export function pipelineErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
