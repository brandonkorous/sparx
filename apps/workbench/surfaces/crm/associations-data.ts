'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE RELATIONSHIP DATA LAYER (docs/144 §6)
//
// "Who else is involved here." A deal has one customer column, and real deals
// are sold to several people — the one who signs it, the one who will use it,
// the one in accounts who pays. This is the layer that finally lets a surface
// say all three.
//
// The read is always ABOUT A RECORD and always covers both directions: the API
// finds a link whether the record is the `from` or the `to` end, and words the
// relationship for the end you are standing on. Nothing here has to know which
// side of a row it is looking at.
//
//   ['crm','associations', objectKey, recordId, {…}]   one record's links
//   ['crm','associations','labels', {…}]               the relationship types
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The record at the other end of a link, named for a chip. */
export interface RelatedRecord {
  objectKey: string;
  recordId: string;
  title: string;
  subtitle?: string;
  /** Soft-deleted. Shown struck through rather than hidden, so a link to a
   *  removed record is visible and fixable instead of silently absent. */
  removed?: boolean;
}

export interface Association {
  id: string;
  labelKey: string | null;
  /** Already worded for the record being viewed — never needs flipping here. */
  label: string;
  isPrimary: boolean;
  note: string | null;
  createdAt: string;
  other: RelatedRecord | null;
  reversed: boolean;
}

export interface AssociationLabel {
  id: string;
  fromType: string;
  toType: string;
  key: string;
  label: string;
  inverseLabel: string;
  isBuiltin: boolean;
  sortOrder: number;
}

export const associationKeys = {
  all: ['crm', 'associations'] as const,
  forRecord: (objectKey: string, recordId: string, params: Record<string, unknown> = {}) =>
    [...associationKeys.all, objectKey, recordId, params] as const,
  labels: (params: Record<string, unknown> = {}) =>
    [...associationKeys.all, 'labels', params] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/**
 * What each kind of record is called in a heading, when there is no declared
 * label to use. Falls back to the key so an object a business invented still
 * reads as something rather than as nothing.
 */
export const OBJECT_LABELS: Record<string, string> = {
  contact: 'People',
  company: 'Companies',
  deal: 'Deals',
  ticket: 'Requests',
};

export function objectLabel(objectKey: string): string {
  return OBJECT_LABELS[objectKey] ?? objectKey.replace(/_/g, ' ');
}

/**
 * Group a record's links by what the relationship is CALLED, in the order they
 * came back — the API sorts primary first, then oldest first, and preserving
 * that inside each group is what keeps the main contact at the top.
 */
export function groupByLabel(items: Association[]): { label: string; items: Association[] }[] {
  const groups = new Map<string, Association[]>();
  for (const item of items) {
    const bucket = groups.get(item.label);
    if (bucket) bucket.push(item);
    else groups.set(item.label, [item]);
  }
  return [...groups].map(([label, grouped]) => ({ label, items: grouped }));
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useAssociations(
  objectKey: string,
  recordId: string,
  params: { toType?: string; labelKey?: string } = {}
) {
  return useQuery({
    queryKey: associationKeys.forRecord(objectKey, recordId, params),
    queryFn: () =>
      api.list<Association>(`/v1/crm/objects/${objectKey}/records/${recordId}/associations`, {
        ...(params.toType ? { to_type: params.toType } : {}),
        ...(params.labelKey ? { label_key: params.labelKey } : {}),
      }),
    // `new` is the create form, which has no record to have relationships yet.
    enabled: recordId !== '' && recordId !== 'new',
    placeholderData: (previous) => previous,
  });
}

export function useAssociationLabels(params: { fromType?: string; toType?: string } = {}) {
  return useQuery({
    queryKey: associationKeys.labels(params),
    queryFn: () =>
      api.list<AssociationLabel>('/v1/crm/association-labels', {
        ...(params.fromType ? { from_type: params.fromType } : {}),
        ...(params.toType ? { to_type: params.toType } : {}),
      }),
    // The list is small, tenant-wide and changes only when an admin reshapes it,
    // so it is worth holding rather than refetching per pane.
    staleTime: 5 * 60_000,
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/**
 * Every association write invalidates BOTH ends.
 *
 * A link added from a deal changes what the contact's pane shows too, and a pane
 * that silently disagrees with the one beside it is worse than one that is a
 * moment behind. Cheap, because the query key is narrow.
 */
function useInvalidateAssociations() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: associationKeys.all });
    // Promoting a link rewrites the record's own customer/company column, so the
    // record itself is stale as well.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'accounts'] });
  };
}

export interface RelateInput {
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  labelKey?: string | null;
  isPrimary?: boolean;
  note?: string | null;
}

export function useRelateRecords() {
  const invalidate = useInvalidateAssociations();
  return useMutation({
    mutationFn: (input: RelateInput) => api.post<Association>('/v1/crm/associations', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAssociation() {
  const invalidate = useInvalidateAssociations();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      labelKey?: string | null;
      note?: string | null;
    }) => api.patch<Association>(`/v1/crm/associations/${id}`, patch),
    onSuccess: invalidate,
  });
}

export function useMakeAssociationPrimary() {
  const invalidate = useInvalidateAssociations();
  return useMutation({
    mutationFn: (id: string) => api.post<Association>(`/v1/crm/associations/${id}/primary`, {}),
    onSuccess: invalidate,
  });
}

export function useUnrelateRecords() {
  const invalidate = useInvalidateAssociations();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/crm/associations/${id}`),
    onSuccess: invalidate,
  });
}

export function associationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
