'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SEGMENT DATA LAYER
//
// A segment is a saved GROUP of customers who share something — big spenders,
// or everyone who has not bought in a year. Its membership is worked out from a
// rule tree and materialised by a background evaluator; this surface reads that
// membership and lets an owner rename, re-describe, recolour or archive a
// segment. The rule tree itself is authored elsewhere (it needs a predicate
// builder), so it is shown here as a read-only summary rather than edited.
//
//   ['crm','segments']              the root every read nests under
//   ['crm','segments','list',{…}]   one list window
//   ['crm','segments', id]          one segment
//   ['crm','segments', id,'members'] a sample of who is in it
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Customer } from './customers-data';
import type { SegmentRule } from './segment-rules';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface Segment {
  id: string;
  propertyId: string | null;
  name: string;
  slug: string;
  description: string | null;
  /** The predicate tree. Opaque here — shown as a count, never edited. */
  rules: unknown;
  color: string | null;
  isSystem: boolean;
  isBuiltIn: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One materialised membership, with the customer it points at. */
export interface SegmentMember {
  customerId: string;
  enteredAt: string;
  customer: Customer;
}

export interface SegmentListParams {
  q?: string;
  includeArchived?: boolean;
}

export const segmentKeys = {
  all: ['crm', 'segments'] as const,
  list: (params: SegmentListParams) => [...segmentKeys.all, 'list', params] as const,
  detail: (id: string) => [...segmentKeys.all, id] as const,
  members: (id: string) => [...segmentKeys.all, id, 'members'] as const,
  count: (id: string) => [...segmentKeys.all, id, 'member-count'] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/** How many conditions a rule tree carries, best-effort, so the list can say
 *  "3 rules" without understanding the predicate language. Falls back to a
 *  generic phrase for a shape it does not recognise. */
export function ruleCount(rules: unknown): number {
  if (!rules || typeof rules !== 'object') return 0;
  const node = rules as { conditions?: unknown; rules?: unknown; all?: unknown; any?: unknown };
  const branch = node.conditions ?? node.rules ?? node.all ?? node.any;
  return Array.isArray(branch) ? branch.length : 0;
}

export function segmentMembership(count: number): string {
  if (count === 0) return 'No members yet';
  if (count === 1) return '1 customer';
  return `${count.toLocaleString()} customers`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useSegments(params: SegmentListParams = {}) {
  return useQuery({
    queryKey: segmentKeys.list(params),
    queryFn: () =>
      api.list<Segment>('/v1/crm/segments', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.includeArchived ? { include_archived: true } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useSegment(id: string) {
  return useQuery({
    queryKey: segmentKeys.detail(id),
    queryFn: () => api.get<Segment>(`/v1/crm/segments/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The count of who is in a segment, from the dedicated count endpoint (cheaper
 *  than paging the whole membership just to size it). */
export function useSegmentMemberCount(id: string) {
  return useQuery({
    queryKey: segmentKeys.count(id),
    queryFn: () => api.get<{ total: number }>(`/v1/crm/segments/${id}/member-count`),
    enabled: id !== 'new',
  });
}

/** A sample of who is in the segment — the first page, newest first. */
export function useSegmentMembers(id: string, limit = 25) {
  return useQuery({
    queryKey: segmentKeys.members(id),
    queryFn: () => api.list<SegmentMember>(`/v1/crm/segments/${id}/members`, { limit }),
    enabled: id !== 'new',
  });
}

/* ── Invalidation + mutations ───────────────────────────────────────────── */

export function useInvalidateSegments() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: segmentKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: segmentKeys.detail(id) });
  };
}

/** The editable slice. `rules` is the server's predicate tree; `slug` is the
 *  kebab id the audience is addressed by. All optional on a PATCH; create sends
 *  name + slug + rules. */
export interface SegmentInput {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  rules?: SegmentRule;
}

/** Create and manage are the same surface, so create sends the whole record. */
export function useCreateSegment() {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: (input: SegmentInput) => api.post<Segment>('/v1/crm/segments', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateSegment(id: string) {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: (patch: SegmentInput) => api.patch<Segment>(`/v1/crm/segments/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Live preview ───────────────────────────────────────────────────────── */

export interface PreviewCount {
  /** How many of the sampled customers matched. */
  matches: number;
  /** How many customers were checked (a recent sample, capped server-side). */
  sampled: number;
  /** The total customer count, for context. */
  total: number;
}

/**
 * How many customers a DRAFT rule matches right now — the live number the rule
 * builder shows as you edit. Distinct from `useSegmentMemberCount`, which is the
 * SAVED, materialised membership (only refreshed when the evaluator re-runs after
 * a save). Pass `null` while the rule is incomplete to skip the request.
 */
export function usePreviewCount(rule: SegmentRule | null) {
  return useQuery({
    queryKey: [...segmentKeys.all, 'preview', rule],
    queryFn: () =>
      api.post<PreviewCount>('/v1/crm/segments/preview-count', { rule, sampleSize: 500 }),
    enabled: rule !== null,
    staleTime: 30_000,
  });
}

/** Archive (soft-delete) a segment — it stops targeting anything but its
 *  definition is kept. */
export function useArchiveSegment(id: string) {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/segments/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function segmentErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
