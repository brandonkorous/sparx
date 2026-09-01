'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE FORM-SUBMISSIONS DATA LAYER
//
// Everything the submissions inbox and the submission detail read or write goes
// through here. One module owns the `FormSubmission` wire shape and the whole
// `['builder','forms']` key tree, so the list and the detail can never disagree
// about a field one of them forgot to fetch, and a status change in the detail
// refreshes the row in the list docked beside it.
//
// A submission is an INBOX RECORD, not the form that produced it — form design
// lives in the visual editor. The body of a submission is SCHEMA-DRIVEN and
// arbitrary: a form's fields are whatever the author dropped onto the page, so
// `fields` is a free-form `key → value` bag rendered generically, never a fixed
// set of columns. The recognised contact trio (name/email/phone) plus `message`
// are promoted to their own columns for the list; every submitted value —
// including custom fields — is also carried verbatim in `fields`.
//
// Unlike the CMS routes, /v1/forms serialises RAW Prisma rows (no snake_case
// serializer), so the wire shape is camelCase. We mirror those names verbatim so
// there is one spelling of each field between the server and the screen.
//
// The inbox is TENANT-WIDE (across every site the tenant owns) — a submission
// outlives a deleted site and stays in the inbox — so the list is walked by a
// keyset cursor (the last row's id), never by offset: submissions arrive at the
// top while an operator reads, and `skip` would re-show rows they already passed.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The triage lifecycle of a submission, exactly as the server stores it.
 *  `new` is untouched, `read` has been opened, `archived` is dealt-with and filed
 *  away ("handled"), `spam` is junk (the honeypot trips this, or a manual flag). */
export type SubmissionStatus = 'new' | 'read' | 'spam' | 'archived';

/** A visitor-uploaded file. The inbox NEVER receives the private storage key —
 *  the server strips it — so a file is downloaded by its INDEX through an
 *  authenticated route, never by addressing the object directly. */
export interface SubmissionAttachment {
  filename: string;
  mimeType: string;
  byteSize: number;
}

/** One inbox record, as api-rest serialises it (raw Prisma, camelCase). */
export interface FormSubmission {
  id: string;
  /** The site it was submitted on. Null once that site is deleted. */
  propertyId: string | null;
  /** The stable Builder node id of the form — keys the "this form" filter. */
  formNodeId: string;
  /** The page it was submitted from; null is the home page. */
  pageSlug: string | null;
  /** The author's label for the form, SNAPSHOTTED at submit — what it was called
   *  then, not what it is called now. Name a row from `forms` instead (`formNamer`):
   *  a form renamed after somebody used it otherwise appears twice in one inbox. */
  formName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  /** Every submitted value, keyed by field name — the full authored set. */
  fields: Record<string, string>;
  attachments: SubmissionAttachment[];
  /** Captured request context — referrer, user-agent, IP, submitted-at. Untrusted
   *  public input: render as TEXT only, never as HTML. */
  context: Record<string, unknown>;
  /** Stored as a bounded string; typed loosely (the `& {}` keeps the known
   *  literals as hints) so an unknown future status degrades to a neutral badge
   *  rather than crashing. */
  status: SubmissionStatus | (string & {});
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A distinct form that has received submissions, for the "which form" filter.
 *  `formName` here is the form's CURRENT name, resolved server-side from the form
 *  definition, so this list is what names the rows. `pageSlug` is the fallback for a
 *  form nobody has named. */
export interface SubmissionFormRef {
  formNodeId: string;
  formName: string | null;
  pageSlug: string | null;
  count: number;
}

/** What the list endpoint returns: the window of rows, the inbox-wide counts
 *  (total + unread, independent of the current filter), and the distinct forms. */
export interface SubmissionListResponse {
  submissions: FormSubmission[];
  counts: { total: number; new: number };
  forms: SubmissionFormRef[];
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export interface SubmissionQuery {
  status?: SubmissionStatus;
  formNodeId?: string;
  /** Keyset cursor — the last id from the previous window. */
  cursor?: string;
  limit: number;
}

export const formsKeys = {
  all: ['builder', 'forms'] as const,
  submissions: () => [...formsKeys.all, 'submissions'] as const,
  // The list namespace sits apart from the detail keys, so a list refresh never
  // re-touches an open detail pane — which matters on delete, where refetching a
  // just-deleted (still-mounted) detail would 404 and re-render the pane mid-close.
  lists: () => [...formsKeys.submissions(), 'list'] as const,
  list: (query: SubmissionQuery) => [...formsKeys.lists(), query] as const,
  detail: (id: string) => [...formsKeys.submissions(), id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useSubmissions(query: SubmissionQuery) {
  return useQuery({
    queryKey: formsKeys.list(query),
    queryFn: () =>
      api.get<SubmissionListResponse>('/v1/forms/submissions', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.formNodeId ? { formNodeId: query.formNodeId } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        limit: query.limit,
      }),
    // Keep the current window on screen while the next one loads, so paging and
    // filtering don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: formsKeys.detail(id),
    queryFn: () => api.get<FormSubmission>(`/v1/forms/submissions/${id}`),
    enabled: id !== '',
    // A 404 means deleted, not broken — don't retry it into a generic failure.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "that changed": refresh the lists, and — when a
 *  specific submission moved — its record, because a status shows in both. Scoped
 *  to `lists()` rather than the whole `submissions()` prefix so it never
 *  re-touches OTHER open detail panes. */
function useInvalidateSubmissions() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: formsKeys.lists() });
    if (id) void queryClient.invalidateQueries({ queryKey: formsKeys.detail(id) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** Set a submission's triage status (read / spam / archived / new). */
export function useSetSubmissionStatus(id: string) {
  const invalidate = useInvalidateSubmissions();
  return useMutation({
    mutationFn: (status: SubmissionStatus) =>
      api.patch<FormSubmission>(`/v1/forms/submissions/${id}`, { status }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteSubmission(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/forms/submissions/${id}`),
    onSuccess: () => {
      // Only the LIST is refreshed. The detail query is deliberately left alone:
      // the delete closes this pane, and refetching (or removing) detail(id) would
      // disturb the pane's own still-mounted observer as dockview commits the
      // close — landing a flushSync inside a lifecycle method. Left alone, the
      // deleted record's cache garbage-collects once the pane unmounts.
      void queryClient.invalidateQueries({ queryKey: formsKeys.lists() });
    },
  });
}
