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
import { apiErrorMessage } from '../../lib/api-error';
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
  /** The author's label for the form ("Contact form"), snapshotted at submit. */
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

/** A distinct form that has received submissions, for the "which form" filter. */
export interface SubmissionFormRef {
  formNodeId: string;
  formName: string | null;
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

/* ── Saying what a state means ──────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What a submission's status means, in an operator's words, with the tone that
 *  carries the state's color on a `<Badge>`. */
export function submissionState(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'new':
      return {
        label: 'New',
        tone: 'info',
        detail: 'Nobody has dealt with this yet.',
      };
    case 'read':
      return {
        label: 'Read',
        tone: 'neutral',
        detail: 'This has been opened, but not yet marked as handled.',
      };
    case 'archived':
      return {
        label: 'Handled',
        tone: 'success',
        detail:
          'This has been dealt with and filed away. You can move it back to your inbox at any time.',
      };
    case 'spam':
      return {
        label: 'Spam',
        tone: 'warning',
        detail: 'This was flagged as junk. It stays here so nothing is silently lost.',
      };
    default:
      return { label: status || 'Unknown', tone: 'neutral', detail: '' };
  }
}

/** A human name for a submission, for the list, the tab and the detail heading.
 *  Prefers who sent it, then how to reach them, then a clear placeholder — never
 *  a blank row. */
export function submitterLabel(
  submission: Pick<FormSubmission, 'name' | 'email' | 'phone'>
): string {
  if (submission.name && submission.name.trim() !== '') return submission.name.trim();
  if (submission.email && submission.email.trim() !== '') return submission.email.trim();
  if (submission.phone && submission.phone.trim() !== '') return submission.phone.trim();
  return 'Anonymous';
}

/** What the form is called, in the words the owner set — or a plain fallback. */
export function formLabel(submission: Pick<FormSubmission, 'formName' | 'formNodeId'>): string {
  if (submission.formName && submission.formName.trim() !== '') return submission.formName.trim();
  return 'Untitled form';
}

/** Where on the site it was submitted from, in plain words. */
export function pageLabel(pageSlug: string | null): string {
  return pageSlug && pageSlug.trim() !== '' ? `/${pageSlug}` : 'Home page';
}

/**
 * The server's own sentence for a 4xx, shown verbatim — the forms routes explain
 * the real problem ("Invalid status.") better than a status code can. A 5xx
 * carries no such sentence, so it falls back to the caller's wording.
 */
export function submissionErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Date and time together — for the moment a submission arrived. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A byte count in the units a person reads. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 bytes';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  if (power === 0) return `${String(bytes)} bytes`;
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[power]}`;
}

/** Turn a field key ("full_name", "phoneNumber") into a readable label. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (spaced === '') return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ── Export ─────────────────────────────────────────────────────────────── */

/** One row of the exported spreadsheet. */
function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Build a two-column (Field, Value) spreadsheet of one submission — everything
 * they sent plus where it came from — as CSV text. A spreadsheet, not JSON,
 * because the person exporting owns a business, not a codebase, and this opens
 * straight into the tool they already use.
 */
export function submissionToCsv(submission: FormSubmission, siteName: string | null): string {
  const rows: [string, string][] = [
    ['Form', formLabel(submission)],
    ['Page', pageLabel(submission.pageSlug)],
    ...(siteName ? ([['Site', siteName]] as [string, string][]) : []),
    ['Submitted', formatDateTime(submission.createdAt)],
    ['Status', submissionState(submission.status).label],
  ];

  const seen = new Set<string>();
  for (const [key, value] of Object.entries(submission.fields)) {
    seen.add(key);
    rows.push([humanizeKey(key), value]);
  }
  // Promoted contact fields that a form somehow didn't echo into `fields`.
  for (const [key, value] of [
    ['name', submission.name],
    ['email', submission.email],
    ['phone', submission.phone],
    ['message', submission.message],
  ] as const) {
    if (!seen.has(key) && value && value.trim() !== '') rows.push([humanizeKey(key), value]);
  }

  const body = ['Field,Value', ...rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`)].join(
    '\r\n'
  );
  // A UTF-8 BOM so spreadsheet apps read accented characters correctly.
  return `\uFEFF${body}`;
}

/** A safe, dated filename for the exported submission. */
export function submissionCsvName(submission: FormSubmission): string {
  const stamp = submission.createdAt.slice(0, 10);
  const who = submitterLabel(submission)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `submission-${stamp}${who ? `-${who}` : ''}.csv`;
}
