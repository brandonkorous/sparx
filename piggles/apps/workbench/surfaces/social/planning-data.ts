'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PLANNING DATA LAYER
//
// The things a business sets up ONCE and then leans on every week — as opposed
// to `data.ts`, which is about individual posts:
//
//   · hashtag sets   — the block of tags you'd otherwise retype every time
//   · posting slots  — "we post Tuesdays at 9", which draws the gaps on the
//                      calendar and (optionally) fills itself from evergreen posts
//   · best time      — when to post, from THIS business's own results
//   · import         — a month of posts from a spreadsheet
//   · share this     — turn a product or article into a suggested draft
//
// Its own door rather than more of data.ts: a hashtag set is not a post, and
// bundling them would give that file a second job.
//
// ── The endpoints (services/api-rest/.../v1/social) ────────────────────────
//   GET    /v1/social/hashtag-sets            → the saved blocks        (viewer)
//   PUT    /v1/social/hashtag-sets            → create or update one    (editor)
//   DELETE /v1/social/hashtag-sets/:id        → remove one              (editor)
//   GET    /v1/social/slots                   → the weekly cadence      (viewer)
//   PUT    /v1/social/slots                   → create or update a slot (editor)
//   DELETE /v1/social/slots/:id               → remove a slot           (editor)
//   GET    /v1/social/best-time?timezone=…    → when to post            (viewer)
//   GET    /v1/social/compose-seed?type&id    → a suggested draft       (editor)
//   POST   /v1/social/import/preview          → parse + report problems (editor)
//   POST   /v1/social/import                  → create the posts        (editor)
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import { socialKeys } from './data';

/* ── Saved hashtag blocks ───────────────────────────────────────────────── */

export interface HashtagSet {
  id: string;
  propertyId: string | null;
  name: string;
  /** Stored without the leading '#'; the UI decides how to render them. */
  tags: string[];
  /** Narrows the set to one platform; null = offer it everywhere. */
  platform: string | null;
  updatedAt: string;
}

export function useHashtagSets() {
  return useQuery({
    queryKey: socialKeys.hashtagSets,
    queryFn: () => api.get<{ sets: HashtagSet[] }>('/v1/social/hashtag-sets').then((r) => r.sets),
  });
}

export interface SaveHashtagSetInput {
  id?: string;
  name: string;
  tags: string[];
  platform?: string | null;
}

export function useSaveHashtagSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveHashtagSetInput) =>
      api.put<HashtagSet>('/v1/social/hashtag-sets', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.hashtagSets });
    },
  });
}

export function useDeleteHashtagSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/social/hashtag-sets/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.hashtagSets });
    },
  });
}

/** The text that actually goes in a post. */
export function tagsToText(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(' ');
}

/* ── The weekly posting cadence ─────────────────────────────────────────── */

export interface PostingSlot {
  id: string;
  propertyId: string | null;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  minuteOfDay: number;
  timezone: string;
  targetIds: string[];
  enabled: boolean;
  /** Whether the evergreen pool may fill this slot, or it is plan-only. */
  autoFill: boolean;
}

export function usePostingSlots() {
  return useQuery({
    queryKey: socialKeys.slots,
    queryFn: () => api.get<{ slots: PostingSlot[] }>('/v1/social/slots').then((r) => r.slots),
  });
}

export interface SaveSlotInput {
  id?: string;
  weekday: number;
  minuteOfDay: number;
  timezone: string;
  targetIds: string[];
  enabled?: boolean;
  autoFill?: boolean;
}

export function useSaveSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSlotInput) => api.put<PostingSlot>('/v1/social/slots', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.slots });
    },
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/social/slots/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.slots });
    },
  });
}

/* ── When to post ───────────────────────────────────────────────────────── */

export interface BestTimeBucket {
  weekday: number;
  hour: number;
  posts: number;
  averageEngagements: number;
}

export interface BestTimeReport {
  timezone: string;
  sampleSize: number;
  /** False when there isn't enough history to recommend anything — the UI must say so
   *  rather than show a confident-looking empty table. */
  confident: boolean;
  buckets: BestTimeBucket[];
}

/** The browser's own zone, so the answer is expressed in the hours a person thinks in. */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useBestTime(timezone: string) {
  return useQuery({
    queryKey: socialKeys.bestTime(timezone),
    queryFn: () => api.get<BestTimeReport>('/v1/social/best-time', { timezone }),
  });
}

/* ── Share something you published ──────────────────────────────────────── */

export type ComposeSeedType = 'product' | 'collection' | 'content';

export interface ComposeSeed {
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  source: ComposeSeedType;
  sourceRef: string;
  propertyId: string | null;
  title: string;
}

/** A suggested draft built from a product, collection or article. Only runs when both
 *  params are present, so the composer can call it unconditionally. */
export function useComposeSeed(type: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['social', 'compose-seed', type ?? null, id ?? null],
    queryFn: () => api.get<ComposeSeed>('/v1/social/compose-seed', { type: type!, id: id! }),
    enabled: Boolean(type && id),
    // A seed is a one-time suggestion; re-fetching it would fight the person's edits.
    staleTime: Infinity,
    retry: false,
  });
}

/* ── A month of posts from a spreadsheet ────────────────────────────────── */

export interface ImportRow {
  line: number;
  body: string;
  link: string | null;
  scheduledAt: string | null;
  targetNames: string[];
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  problems: ImportProblem[];
}

export interface ImportResult {
  created: number;
  scheduled: number;
  problems: ImportProblem[];
  postIds: string[];
}

/** Parse + check a file WITHOUT creating anything, so nobody discovers a broken import
 *  by finding thirty half-right drafts. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: (csv: string) => api.post<ImportPreview>('/v1/social/import/preview', { csv }),
  });
}

export function useRunImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { csv: string; defaultTargetIds?: string[] }) =>
      api.post<ImportResult>('/v1/social/import', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
    },
  });
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** "9:00 AM" from minutes past midnight, in the reader's locale. */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const sample = new Date(Date.UTC(2024, 0, 7, Math.floor(minuteOfDay / 60), minuteOfDay % 60));
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(sample);
}

/** "09:00" for a `<input type="time">`. */
export function minuteOfDayToTimeInput(minuteOfDay: number): string {
  const h = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const m = String(minuteOfDay % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** "09:00" → 540. Returns null for anything unparseable. */
export function timeInputToMinuteOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
