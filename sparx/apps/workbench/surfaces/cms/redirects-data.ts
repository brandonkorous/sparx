'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE REDIRECTS DATA LAYER
//
// A redirect sends anyone who follows an old link to the new page instead of
// hitting a dead end. There is no "edit a redirect" on this platform — a rule is
// created, imported in bulk, or deleted, never changed in place (the server has
// no PATCH). So this module is deliberately small: one list, three writes, and
// the pure text parser the bulk-import pane leans on.
//
// api-rest is snake_case on the wire (see `toApiRedirect` in
// wizeworks/services/api-rest/src/routes/v1/redirects) and `hit_count` arrives as a plain
// number the route already converted from a Prisma BigInt. We keep those field
// names verbatim rather than re-mapping, so there is one spelling of each field
// between the server and the screen.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The HTTP status codes api-rest accepts. 301/308 mean "moved for good",
 *  302/307 mean "moved for now"; the 307/308 pair additionally preserves the
 *  request method, which matters for form and API paths. */
export type RedirectStatusCode = 301 | 302 | 307 | 308;

/** One redirect rule, exactly as api-rest serialises it. `property_id` is the
 *  site whose address this fires on, or `null` for a rule shared across every
 *  site the business runs. */
export interface Redirect {
  id: string;
  property_id: string | null;
  from_path: string;
  to_path: string;
  status_code: RedirectStatusCode;
  hit_count: number;
  created_at: string;
}

/** What POST /v1/redirects/bulk reports back: how many rules went in, and every
 *  row it turned away with the reason (a duplicate, a loop, its own reflection).
 *  `row` is the index into the array that was SENT, not the source line. */
export interface BulkImportResult {
  inserted: number;
  skipped: { row: number; reason: string }[];
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export interface RedirectQuery {
  take: number;
  skip: number;
}

export const redirectKeys = {
  all: ['cms', 'redirects'] as const,
  lists: () => [...redirectKeys.all, 'list'] as const,
  list: (query: RedirectQuery) => [...redirectKeys.lists(), query] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * The redirects that fire on the site being worked in, plus any shared across
 * every site — the server resolves that scope from the `x-sparx-property-id`
 * header the client attaches, so the pane never has to think about it. Ordered
 * by the old address, which is how someone hunts for "the rule on /old-pricing".
 */
export function useRedirects(query: RedirectQuery) {
  return useQuery({
    queryKey: redirectKeys.list(query),
    queryFn: () => api.list<Redirect>('/v1/redirects', { take: query.take, skip: query.skip }),
    // Keeps the current window on screen while the next page loads, so paging
    // never blinks the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "that changed": refresh every list window.
 *  There are no detail panes to touch — a redirect has no editable surface. */
function useInvalidateRedirects() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: redirectKeys.lists() });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface CreateRedirectInput {
  from_path: string;
  to_path: string;
  status_code: RedirectStatusCode;
}

/** Add one redirect. `property_id` is deliberately omitted so the server lands
 *  it on the site being worked in — the same default the bulk import uses. */
export function useCreateRedirect() {
  const invalidate = useInvalidateRedirects();
  return useMutation({
    mutationFn: (input: CreateRedirectInput) => api.post<Redirect>('/v1/redirects', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Import a batch. Partial success is normal and expected: the server inserts
 *  what it can and reports the rest as `skipped` with a reason, so the caller
 *  shows which rows still need attention rather than failing the whole import. */
export function useBulkCreateRedirects() {
  const invalidate = useInvalidateRedirects();
  return useMutation({
    mutationFn: (rows: CreateRedirectInput[]) =>
      api.post<BulkImportResult>('/v1/redirects/bulk', { rows }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Remove a redirect. The old link goes back to being a dead end, so this is
 *  guarded by a confirm at the call site. */
export function useDeleteRedirect() {
  const invalidate = useInvalidateRedirects();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/redirects/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a redirect type means ──────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface RedirectTypeMeta {
  /** The word an owner would use, not the number. */
  label: string;
  /** The color that word wears on a `<Badge>`. */
  tone: Tone;
  /** One plain sentence on what choosing this actually does. */
  detail: string;
}

/**
 * What a status code means, in the words a business owner would use.
 *
 * Permanent (301/308) reads as a settled fact — info. Temporary (302/307) is a
 * transient state that someone will come back and undo — warning, so it stands
 * out in a list as the one that is not meant to last. 307/308 additionally keep
 * the request method; the list only ever needs the plain distinction, so both
 * fold into Permanent/Temporary.
 */
export function redirectTypeMeta(code: number): RedirectTypeMeta {
  switch (code) {
    case 302:
      return {
        label: 'Temporary',
        tone: 'warning',
        detail:
          'A short-term move. Search engines keep the old address on file and expect it back, so use this while a page is briefly away.',
      };
    case 307:
      return {
        label: 'Temporary',
        tone: 'warning',
        detail:
          'A short-term move that keeps the request exactly as it was — for form and checkout paths that are briefly away.',
      };
    case 308:
      return {
        label: 'Permanent',
        tone: 'info',
        detail:
          'A permanent move that keeps the request exactly as it was — for form and checkout paths that have moved for good.',
      };
    case 301:
      return {
        label: 'Permanent',
        tone: 'info',
        detail:
          'The old address has moved for good. Search engines update to the new one and pass on its standing.',
      };
    default:
      return {
        label: `Code ${String(code)}`,
        tone: 'neutral',
        detail: 'An uncommon redirect type set up elsewhere.',
      };
  }
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * The server's own sentence for a 4xx, shown verbatim: the redirect routes
 * explain the real problem ("A redirect from "/x" already exists", "A redirect
 * cannot point to itself", "Redirect would create a loop via …") far better than
 * a status code can. A 5xx carries no such sentence, so it falls back to the
 * caller's wording.
 */
export function redirectErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/* ── Formatting + paths ─────────────────────────────────────────────────── */

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/**
 * Nudge a typed address towards what the server accepts.
 *
 * Both paths must begin with "/". Someone typing "old-pricing" means "/old-pricing",
 * so we add the slash for them rather than bouncing the form. A full URL
 * (anything with "://") is left untouched so it can be flagged honestly — the
 * platform only redirects between paths on the same site, never off to another
 * address.
 */
export function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed.includes('://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** One parsed line of a pasted import, ready to preview before it is sent. */
export interface ParsedRedirectRow {
  /** 1-based line number in the pasted text, for pointing at the problem. */
  line: number;
  from: string;
  to: string;
  statusCode: RedirectStatusCode;
  /** Why this row cannot be sent, or null when it is good to go. */
  error: string | null;
}

/** Read a type hint from a third column: a word or a raw code, else Permanent. */
function statusFromHint(hint: string | undefined): RedirectStatusCode {
  const value = (hint ?? '').trim().toLowerCase();
  if (value === 'temporary' || value === 'temp' || value === '302' || value === '307') return 302;
  return 301;
}

/**
 * Turn pasted text into preview rows.
 *
 * One redirect per line, "old, new" — a comma, a tab (what a spreadsheet paste
 * gives), or an arrow between them, with an optional third column saying
 * permanent or temporary. Blank lines are ignored so a padded paste is fine.
 * Every row is validated here so the preview can show exactly what will and will
 * not import BEFORE anything is sent, and duplicate old addresses within the one
 * paste are caught locally rather than bounced one-by-one by the server.
 */
export function parseRedirectRows(text: string): ParsedRedirectRow[] {
  const rows: ParsedRedirectRow[] = [];
  const seen = new Map<string, number>();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (raw.trim() === '') continue;

    // Prefer a tab or comma; fall back to an arrow, then to plain whitespace, so
    // "old → new", "old,new" and "old   new" all read the same way.
    const parts = raw.includes('\t')
      ? raw.split('\t')
      : raw.includes(',')
        ? raw.split(',')
        : raw.includes('→') || raw.includes('->')
          ? raw.split(/→|->/)
          : raw.trim().split(/\s+/);

    const from = normalizePath(parts[0] ?? '');
    const to = normalizePath(parts[1] ?? '');
    const statusCode = statusFromHint(parts[2]);

    let error: string | null = null;
    if (from === '' || to === '') {
      error = 'Give both an old address and where it should go.';
    } else if (!from.startsWith('/') || !to.startsWith('/')) {
      error = 'Both addresses must be a path on your site, starting with a slash.';
    } else if (from === to) {
      error = 'The old and new addresses are the same.';
    } else {
      const earlier = seen.get(from);
      if (earlier) {
        error = `Same old address as line ${String(earlier)} — only the first will be kept.`;
      } else {
        seen.set(from, i + 1);
      }
    }

    rows.push({ line: i + 1, from, to, statusCode, error });
  }

  return rows;
}
