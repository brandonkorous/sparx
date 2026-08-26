'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SEGMENT DATA LAYER — reads, and the one import site for the whole layer
//
// A segment is a saved GROUP of customers who share something — big spenders,
// or everyone who has not bought in a year. Its membership is worked out from a
// rule tree and materialised by a background evaluator; this file reads that
// membership. Shapes and keys are in ./segments-types, writing in
// ./segments-mutations, hand-picked lists in ./segments-lists-data — all three
// re-exported here so a call site imports one module.
//
//   ['crm','segments']              the root every read nests under
//   ['crm','segments','list',{…}]   one list window
//   ['crm','segments', id]          one segment
//   ['crm','segments', id,'members'] a sample of who is in it
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import {
  segmentKeys,
  type Segment,
  type SegmentListParams,
  type SegmentMember,
} from './segments-types';
import type { SegmentRule } from './segment-rules';

export * from './segments-types';
export * from './segments-mutations';
export * from './segments-lists-data';

export function segmentErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
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

/* ── Live preview ───────────────────────────────────────────────────────── */

export interface PreviewCount {
  /** How many of the sampled customers matched. */
  matches: number;
  /** How many customers were checked (a recent sample, capped server-side). */
  sampled: number;
  /** The total customer count, for context. */
  total: number;
}

/** How many customers a DRAFT rule matches right now — the live number the rule
 *  builder shows as you edit. Distinct from `useSegmentMemberCount`, which is the
 *  SAVED membership. Pass `null` while the rule is incomplete to skip the request. */
export function usePreviewCount(rule: SegmentRule | null) {
  return useQuery({
    queryKey: [...segmentKeys.all, 'preview', rule],
    queryFn: () =>
      api.post<PreviewCount>('/v1/crm/segments/preview-count', { rule, sampleSize: 500 }),
    enabled: rule !== null,
    staleTime: 30_000,
  });
}
