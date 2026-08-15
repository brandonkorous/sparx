'use client';

// The data layer for scoring (docs/144 §10).
//
//   ['crm','scoring']                      root
//   ['crm','scoring','models',objectKey]   the tenant's models
//   ['crm','scoring','fields']             what a rule can ask about
//   ['crm','scoring',id]                   one model
//   ['crm','scoring','preview',…]          what a rule set would score
//   ['crm','scoring','history',…]          one record's score history
//
// Every key sits under `['crm','scoring']` so the single invalidator reaches all
// of them. This is the trap that shipped a live bug in phase 4: keys declared
// inside one object literal are not necessarily under that object's `all`
// prefix, and an invalidate that misses leaves a stale picker or a stale number
// on screen next to a fresh one.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface ConditionLeaf {
  field: string;
  operator: string;
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionGroup)[];
}

export interface ScoringRule {
  condition: ConditionGroup;
  points: number;
  label: string;
}

export interface ScoringModel {
  id: string;
  name: string;
  description: string | null;
  objectKey: string;
  propertyId: string | null;
  rules: ScoringRule[];
  decayPerDay: string | number | null;
  maxScore: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringField {
  path: string;
  label: string;
  kind: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'list';
}

export interface ScoringObject {
  objectKey: string;
  label: string;
  labelPlural: string;
  fields: ScoringField[];
}

export interface ScoreBreakdown {
  score: number;
  reasons: { label: string; points: number }[];
  decayed: number;
}

export interface ScoreEventRow {
  id: string;
  objectKey: string;
  recordId: string;
  delta: number;
  score: number;
  reason: string | null;
  source: 'rule' | 'decay' | 'manual' | 'recompute';
  actorId: string | null;
  occurredAt: string;
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const scoringKeys = {
  all: ['crm', 'scoring'] as const,
  models: (objectKey?: string) => ['crm', 'scoring', 'models', objectKey ?? null] as const,
  fields: ['crm', 'scoring', 'fields'] as const,
  detail: (id: string) => ['crm', 'scoring', id] as const,
  preview: (input: unknown) => ['crm', 'scoring', 'preview', input] as const,
  history: (objectKey: string, recordId: string) =>
    ['crm', 'scoring', 'history', objectKey, recordId] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/** The two things a business scores today. Written here rather than derived from
 *  the fields response so the picker renders before the fields load. */
export const SCOREABLE = [
  { objectKey: 'contact', label: 'Customers', hint: 'How interested somebody looks' },
  { objectKey: 'deal', label: 'Sales deals', hint: 'How likely a deal is to close' },
] as const;

/** What a score MEANS at a glance. Bands rather than a gradient, because a
 *  business owner acts on "hot / warm / cold", not on 61 versus 64. */
export function scoreBand(
  score: number,
  max = 100
): {
  label: string;
  color: 'error' | 'warning' | 'success' | 'neutral';
} {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 70) return { label: 'Hot', color: 'success' };
  if (pct >= 40) return { label: 'Warm', color: 'warning' };
  if (pct > 0) return { label: 'Cool', color: 'neutral' };
  // "Cold", NOT "not scored". Once a model exists, a zero is a real verdict —
  // the rules ran and nothing matched. Calling that "not scored" tells an owner
  // the machinery never looked at this person, which is a different fact and a
  // false one. Whether anything has been scored AT ALL is `scoredAt`'s job, and
  // the panel reads it there.
  return { label: 'Cold', color: 'neutral' };
}

/** How a score change came about, in words. */
export const SOURCE_LABEL: Record<ScoreEventRow['source'], string> = {
  rule: 'Your rules',
  decay: 'Gone quiet',
  manual: 'Changed by hand',
  recompute: 'Re-scored',
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useScoringModels(objectKey?: string) {
  return useQuery({
    queryKey: scoringKeys.models(objectKey),
    queryFn: () =>
      api.list<ScoringModel>('/v1/crm/scoring/models', objectKey ? { object_key: objectKey } : {}),
    placeholderData: (previous) => previous,
  });
}

export function useScoringModel(id: string) {
  return useQuery({
    queryKey: scoringKeys.detail(id),
    queryFn: () => api.get<ScoringModel>(`/v1/crm/scoring/models/${id}`),
    enabled: id !== 'new' && id !== '',
  });
}

/** What a rule can ask about — the compiler's own allowlist, so the editor can
 *  only offer questions that will actually be answered. */
export function useScoringFields() {
  return useQuery({
    queryKey: scoringKeys.fields,
    queryFn: () => api.get<{ objects: ScoringObject[] }>('/v1/crm/scoring/fields'),
    staleTime: 30 * 60_000,
  });
}

/**
 * What an unsaved rule set would score ONE real record.
 *
 * The whole reason the editor is usable: a rule list is abstract until you see it
 * land on somebody you recognise. Disabled until a record is picked, so the
 * surface does not fire a request while an author is still choosing.
 */
export function useScorePreview(input: {
  objectKey: string;
  recordId: string | null;
  rules: ScoringRule[];
  decayPerDay: number | null;
  maxScore: number;
}) {
  return useQuery({
    queryKey: scoringKeys.preview(input),
    queryFn: () =>
      api.post<ScoreBreakdown | null>('/v1/crm/scoring/preview', {
        objectKey: input.objectKey,
        recordId: input.recordId,
        rules: input.rules,
        decayPerDay: input.decayPerDay,
        maxScore: input.maxScore,
      }),
    enabled: input.recordId !== null,
    // Keep the last good breakdown while the next runs — a preview that blanks
    // on every keystroke is unreadable.
    placeholderData: (previous) => previous,
    retry: false,
  });
}

/**
 * Why this record scores what it scores, RIGHT NOW.
 *
 * The same preview endpoint the rule editor uses, called with no rule override —
 * which makes the server fall back to the saved model, so this is the live
 * breakdown rather than a hypothetical one. Sending the record's own rules back
 * up would be a second copy of the model that goes stale the moment somebody
 * edits it.
 */
export function useScoreBreakdown(objectKey: string, recordId: string) {
  return useQuery({
    queryKey: scoringKeys.preview({ objectKey, recordId, live: true }),
    queryFn: () =>
      api.post<ScoreBreakdown | null>('/v1/crm/scoring/preview', { objectKey, recordId }),
    enabled: recordId !== '',
    retry: false,
  });
}

/**
 * The model that is actually running for an object, if there is one.
 *
 * Null is a REAL answer and the common one — a business that has never set up
 * scoring has no model, and every record sits at zero. The panel says that in
 * words instead of showing a confident 0, which would read as "we scored them
 * and they came out worthless".
 */
export function useActiveScoringModel(objectKey: string): ScoringModel | null {
  const { data } = useScoringModels(objectKey);
  return (data?.items ?? []).find((m) => m.isActive) ?? null;
}

/** One record's score history — the "why is this 74" panel. */
export function useScoreHistory(objectKey: string, recordId: string) {
  return useQuery({
    queryKey: scoringKeys.history(objectKey, recordId),
    queryFn: () =>
      api.list<ScoreEventRow>('/v1/crm/scoring/history', {
        object_key: objectKey,
        record_id: recordId,
      }),
    enabled: recordId !== '',
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

function useInvalidateScoring() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: scoringKeys.all });
    // Scores live ON customer and deal rows, so a recompute or an adjustment
    // changes what every list of them shows. Missing this is how a re-scored
    // contact keeps showing its old number until somebody reloads.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
  };
}

export function useCreateScoringModel() {
  const invalidate = useInvalidateScoring();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<ScoringModel>('/v1/crm/scoring/models', input),
    onSuccess: invalidate,
  });
}

export function useUpdateScoringModel(id: string) {
  const invalidate = useInvalidateScoring();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<ScoringModel>(`/v1/crm/scoring/models/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveScoringModel() {
  const invalidate = useInvalidateScoring();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ archived: boolean }>(`/v1/crm/scoring/models/${id}`),
    onSuccess: invalidate,
  });
}

export interface RecomputeResult {
  scanned: number;
  changed: number;
  nextCursor: string | null;
}

/**
 * Re-score everything, one page at a time.
 *
 * Loops in the CLIENT rather than asking the server for an unbounded job,
 * because the server bounds each call to keep one transaction short. The loop is
 * capped so a bug in the cursor cannot spin forever against a tenant's database.
 */
export function useRecomputeScores() {
  const invalidate = useInvalidateScoring();
  return useMutation({
    mutationFn: async (objectKey: string) => {
      let cursor: string | null = null;
      let scanned = 0;
      let changed = 0;
      for (let page = 0; page < 200; page += 1) {
        const result: RecomputeResult = await api.post<RecomputeResult>(
          '/v1/crm/scoring/recompute',
          { objectKey, cursor, limit: 200 }
        );
        scanned += result.scanned;
        changed += result.changed;
        cursor = result.nextCursor;
        if (cursor === null) break;
      }
      return { scanned, changed, nextCursor: cursor };
    },
    onSuccess: invalidate,
  });
}

export function useAdjustScore() {
  const invalidate = useInvalidateScoring();
  return useMutation({
    mutationFn: (input: { objectKey: string; recordId: string; delta: number; reason: string }) =>
      api.post<{ score: number; previous: number }>('/v1/crm/scoring/adjust', input),
    onSuccess: invalidate,
  });
}
