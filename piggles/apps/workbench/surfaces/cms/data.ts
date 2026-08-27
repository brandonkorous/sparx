'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CONTENT DATA LAYER
//
// Everything the Content list and the Content editor read or write goes through
// here. One module owns the `ContentEntry`/`ContentType`/`ContentRevision` wire
// shapes and the whole `['cms','content']` key tree, so the list and the editor
// can never disagree about a field one of them forgot to fetch, and a Save in
// the editor refreshes the row in the list docked beside it.
//
// The body of an entry is SCHEMA-DRIVEN: an entry's `type_key` resolves to a
// `ContentType` whose `schema_json.fields` describe what the body holds. The
// editor renders a field per definition — nothing about the body is hardcoded
// here or there. That is why `useContentType` sits next to `useContentEntry`:
// you cannot render an entry without its type.
//
// api-rest is snake_case on the wire (see serializeEntry / serializeContentType
// in @wizeworks/cms). We keep those names verbatim rather than re-mapping, so there
// is exactly one spelling of each field between the server and the screen.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── The content-type field schema ──────────────────────────────────────────
 *
 * A local mirror of the `FieldDef` union that @wizeworks/cms-schemas validates on
 * the server. The browser only READS this — it renders a control per field and
 * never validates — so it carries the shape, not the zod schema, and the
 * workbench stays free of a schemas dependency. If the server union grows a
 * field type this doesn't know, `SchemaField` falls through to a text input
 * rather than breaking, so the two can drift by one release without a crash. */

interface BaseField {
  key: string;
  label: string;
  helpText?: string;
  required?: boolean;
}

export type FieldDef =
  | (BaseField & { type: 'text'; placeholder?: string; max?: number; min?: number })
  | (BaseField & { type: 'long_text'; rows?: number; max?: number; min?: number })
  | (BaseField & { type: 'rich_text' })
  | (BaseField & { type: 'slug'; sourceField?: string; max?: number })
  | (BaseField & { type: 'number'; min?: number; max?: number; integer?: boolean })
  | (BaseField & { type: 'boolean'; default?: boolean })
  | (BaseField & { type: 'date' })
  | (BaseField & { type: 'datetime' })
  | (BaseField & {
      type: 'enum';
      options: { value: string; label: string }[];
      multiple?: boolean;
    })
  | (BaseField & { type: 'url' })
  | (BaseField & { type: 'email' })
  | (BaseField & { type: 'reference'; to: string; multiple?: boolean; min?: number; max?: number })
  | (BaseField & { type: 'asset'; accept?: string[]; multiple?: boolean })
  | ObjectFieldDef
  | RepeaterFieldDef;

export type ObjectFieldDef = BaseField & { type: 'object'; fields: FieldDef[] };

export type RepeaterFieldDef = BaseField & {
  type: 'repeater';
  itemLabel?: string;
  min?: number;
  max?: number;
  fields: FieldDef[];
};

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** The stored lifecycle of an entry. `draft` is written but not on the site,
 *  `scheduled` goes live at a set time, `published` is live now, `archived` is
 *  taken down but kept for history. */
export type EntryStatus = 'draft' | 'scheduled' | 'published' | 'archived';

/** One editable record, exactly as api-rest serialises it. `body` and `seo` are
 *  free-form JSON whose shape is defined by the entry's content type. */
export interface ContentEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: EntryStatus;
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
  published_at: string | null;
  scheduled_at: string | null;
  archived_at: string | null;
  author_id: string | null;
  locale_code: string | null;
  parent_entry_id: string | null;
  created_at: string;
  updated_at: string;
  /** Set when this page IS a policy — privacy, terms, returns and the rest. */
  legal_kind: string | null;
  /** Whether the owner has said they have read the starter wording. */
  legal_reviewed: boolean;
  /** Only present on GET one — the sites this entry publishes to (empty = all). */
  propertyIds?: string[];
}

/** A class of content — "a blog post has these fields". `schema_json.fields` is
 *  what the editor renders a form from. */
export interface ContentType {
  id: string;
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  icon: string | null;
  url_pattern: string | null;
  is_singleton: boolean;
  is_built_in: boolean;
  schema_json: { fields: FieldDef[] };
  created_at: string;
  updated_at: string;
}

/** One point in an entry's history. Metadata only — the full body of a revision
 *  is fetched on demand when someone restores it. */
export interface ContentRevision {
  revision_number: number;
  kind: 'autosave' | 'manual';
  status: EntryStatus;
  summary: string | null;
  author_id: string | null;
  created_at: string;
}

/** A byline. Distinct from a staff user — one person can publish under several
 *  author names, and an author can outlive the account it was tied to. */
export interface Author {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export interface EntryQuery {
  q?: string;
  type?: string;
  status?: EntryStatus;
  take: number;
  skip: number;
}

export const contentKeys = {
  all: ['cms', 'content'] as const,
  entries: () => [...contentKeys.all, 'entries'] as const,
  // The list namespace is separate from the detail keys under `entries()`, so a
  // list refresh can be targeted WITHOUT also re-touching every open detail —
  // which matters on delete, where refetching the just-deleted (still-mounted)
  // detail would 404 and re-render the pane mid-close.
  lists: () => [...contentKeys.entries(), 'list'] as const,
  list: (query: EntryQuery) => [...contentKeys.lists(), query] as const,
  detail: (id: string) => [...contentKeys.entries(), id] as const,
  revisions: (id: string) => [...contentKeys.entries(), id, 'revisions'] as const,
  types: () => [...contentKeys.all, 'types'] as const,
  authors: () => [...contentKeys.all, 'authors'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useContentEntries(query: EntryQuery) {
  return useQuery({
    queryKey: contentKeys.list(query),
    queryFn: () =>
      api.list<ContentEntry>('/v1/content/entries', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Keeps the current window on screen while the next one loads, so paging and
    // filtering don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useContentEntry(id: string) {
  return useQuery({
    queryKey: contentKeys.detail(id),
    queryFn: () => api.get<ContentEntry>(`/v1/content/entries/${id}`),
    // 'new' is the editor before the entry exists — nothing to fetch.
    enabled: id !== 'new',
    // A 404 means deleted, not broken — don't retry it into a generic failure.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/**
 * Every content type this business can use — built-ins plus any it defined.
 *
 * Long-lived: types are a vocabulary set up rarely and referenced constantly.
 * The editor needs the full list to render a body form and to name a row's type
 * in the list, and it is a small, bounded set.
 */
export function useContentTypes() {
  return useQuery({
    queryKey: contentKeys.types(),
    queryFn: () => api.list<ContentType>('/v1/content/types', { take: 250 }).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

/** Every byline, for the author picker and for naming a row's author. */
export function useAuthors() {
  return useQuery({
    queryKey: contentKeys.authors(),
    queryFn: () => api.list<Author>('/v1/authors', { take: 250 }).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

export function useRevisions(id: string) {
  return useQuery({
    queryKey: contentKeys.revisions(id),
    queryFn: () => api.get<ContentRevision[]>(`/v1/content/entries/${id}/revisions`),
    enabled: id !== 'new',
  });
}

/** The root of the legal checklist's query keys.
 *
 *  It lives HERE, in the content module, rather than beside the checklist that
 *  owns it — because this module has to invalidate it (a legal page is a content
 *  entry) and legal-data already imports this one, so owning it there and
 *  reaching for it here would be a cycle. Two hand-written copies of a query key
 *  drift silently: the invalidation goes on succeeding against a key nothing
 *  reads. */
export const LEGAL_QUERY_ROOT = ['cms', 'legal'] as const;

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The ONE way anything here says "that changed": refresh the lists, and — when
 *  a specific entry moved — its record and its history, because a status or a
 *  title shows in all three. Scoped to `lists()` rather than the whole `entries()`
 *  prefix so it never re-touches OTHER open detail panes.
 *
 *  The legal checklist is refreshed too, and not as a nicety: a legal page IS an
 *  ordinary content entry, so publishing one from the editor is the ONLY way its
 *  checklist row can go green. Without this, four policies could be published one
 *  after another while the Legal pages surface went on saying "0 of 4 required
 *  ready" — which reads as "publishing did not work" rather than "this list is a
 *  minute old". It is a checklist; being right about what is done is its job. */
function useInvalidateContent() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: LEGAL_QUERY_ROOT });
    if (id) {
      // detail(id) is the prefix of revisions(id), so this covers both.
      void queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
    }
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface CreateEntryInput {
  type_key: string;
  slug?: string;
  body?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  author_id?: string;
}

export function useCreateEntry() {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (input: CreateEntryInput) => api.post<ContentEntry>('/v1/content/entries', input),
    onSuccess: (entry) => {
      invalidate(entry.id);
    },
  });
}

export interface UpdateEntryInput {
  slug?: string;
  body?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  author_id?: string | null;
}

export function useUpdateEntry(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (input: UpdateEntryInput) =>
      api.patch<ContentEntry>(`/v1/content/entries/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteEntry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/content/entries/${id}`),
    onSuccess: () => {
      // Only the LIST is refreshed. The detail query is deliberately left
      // untouched: the delete closes this pane, and either refetching OR
      // removing detail(id) would synchronously disturb the pane's own
      // still-mounted observer while dockview commits the close — which lands a
      // flushSync inside a lifecycle method. Left alone, the deleted entry's
      // cache simply garbage-collects once the pane unmounts.
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

/** Put it live now, or set it to go live at a time. Omitting `scheduledAt`
 *  publishes immediately; passing one schedules it. */
export function usePublishEntry(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (scheduledAt?: string) =>
      api.post<ContentEntry>(
        `/v1/content/entries/${id}/publish`,
        scheduledAt ? { scheduled_at: scheduledAt } : {}
      ),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Take it back off the site, to a draft. A no-op on something already a draft. */
export function useUnpublishEntry(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: () => api.post<ContentEntry>(`/v1/content/entries/${id}/unpublish`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Bring an old version back. Non-destructive — it copies the old body forward
 *  as a new version, so the history reads straight through. */
export function useRestoreRevision(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (revisionNumber: number) =>
      api.post<ContentEntry>(`/v1/content/entries/${id}/revisions/${revisionNumber}/restore`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Saying what a state means ──────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * What an entry's status means, in the words an owner would use, with the tone
 * that carries the state's color on a `<Badge>`.
 */
export function entryStatusState(status: EntryStatus): {
  label: string;
  tone: Tone;
  detail: string;
} {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        tone: 'success',
        detail: 'This is live on your site — anyone can read it now.',
      };
    case 'scheduled':
      return {
        label: 'Scheduled',
        tone: 'warning',
        detail: 'This will go live on its own at the time you set. Until then nobody can see it.',
      };
    case 'archived':
      return {
        label: 'Archived',
        tone: 'neutral',
        detail:
          'This has been taken down and is no longer on your site. It is kept so you can bring it back or refer to it.',
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        tone: 'info',
        detail: 'This is saved but hidden — only you can see it until you publish it.',
      };
  }
}

/**
 * A human title for an entry, for lists and tabs.
 *
 * Almost every content type has a `title` field, so its body value is the name
 * people know the entry by. Falls back to the slug, then to a clear placeholder
 * — never a blank row.
 */
export function entryTitle(entry: Pick<ContentEntry, 'body' | 'slug'>): string {
  const title = entry.body.title;
  if (typeof title === 'string' && title.trim() !== '') return title.trim();
  const name = entry.body.name;
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  if (entry.slug && entry.slug.trim() !== '') return `/${entry.slug}`;
  return 'Untitled';
}

/**
 * The server's own sentence for a 4xx, shown verbatim: the content routes
 * explain the real problem ("A blog post with slug "x" already exists", "Body
 * failed validation: title is required") far better than a status code can. A
 * 5xx carries no such sentence, so it falls back to the caller's wording.
 */
export function contentErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Date and time together — for a scheduled/published moment, where the time
 *  is part of the fact. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Remove empty values from a body/seo object, deeply.
 *
 * The editor keeps every schema field in state whether or not it is filled; an
 * untouched optional field would otherwise ride along as `""` and count as a
 * change against a server body that never had the key. Pruning before both the
 * dirty check AND the write keeps "have I changed anything?" honest and keeps
 * the payload clean.
 */
export function pruneEmpty(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    const pruned = prune(raw);
    if (pruned !== undefined) out[key] = pruned;
  }
  return out;
}

function prune(raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') return raw.trim() === '' ? undefined : raw;
  if (Array.isArray(raw)) {
    const items = raw.map(prune).filter((v) => v !== undefined);
    return items.length === 0 ? undefined : items;
  }
  if (typeof raw === 'object') {
    const obj = prune0(raw as Record<string, unknown>);
    return Object.keys(obj).length === 0 ? undefined : obj;
  }
  return raw;
}

function prune0(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    const pruned = prune(raw);
    if (pruned !== undefined) out[key] = pruned;
  }
  return out;
}
