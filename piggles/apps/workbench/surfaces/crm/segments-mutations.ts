'use client';

// Writing to a segment: creating one, editing it, archiving it, and the two
// escape hatches that re-cut membership by hand. Reads live in ./segments-data,
// which re-exports this file so call sites see one module.

import { useMutation, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { segmentKeys, type Segment } from './segments-types';
import type { SegmentRule } from './segment-rules';

export function useInvalidateSegments() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: segmentKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: segmentKeys.detail(id) });
  };
}

/** How many customers moved, and how many were checked to find out. */
export interface RecomputeResult {
  scanned: number;
  changed: number;
}

/** Re-cut ONE group across every customer, now. Membership normally keeps
 *  itself current; this is for a group that was seeded rather than created, or
 *  one whose customers changed while something was down. */
export function useRecomputeSegment() {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: (id: string) => api.post<RecomputeResult>(`/v1/crm/segments/${id}/recompute`, {}),
    onSuccess: (_result, id) => {
      invalidate(id);
    },
  });
}

/** The same, for every group at once. Staleness arrives that way — built-in
 *  groups are all seeded together, and anything that stops events reaching the
 *  evaluator stops them for all of them — so the remedy belongs on the list. */
export function useRecomputeAllSegments() {
  const invalidate = useInvalidateSegments();
  return useMutation({
    mutationFn: () => api.post<RecomputeResult>('/v1/crm/segments/recompute', {}),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** The editable slice. `rules` is the server's predicate tree; `slug` is the
 *  kebab id the audience is addressed by. All optional on a PATCH; create sends
 *  name + slug + rules. */
export interface SegmentInput {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  kind?: 'dynamic' | 'static';
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
