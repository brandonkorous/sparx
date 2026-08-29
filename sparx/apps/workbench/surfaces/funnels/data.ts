'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CAMPAIGNS DATA LAYER
//
// A campaign is a named path to an outcome: somebody sees a page, gives you
// their details, and eventually does the thing you wanted. This module is what
// says those steps belong together, and reports how many people got from one end
// to the other.
//
// This file is the ONE door to /v1/funnels. Both surfaces read and write through
// here, so the cache keys and the wire shapes live in one place.
//
// ── The endpoints (wizeworks/services/api-rest/.../v1/funnels) ──────────────
//   GET    /v1/funnels                → the list, newest activity first
//   POST   /v1/funnels                → create (always a draft)
//   GET    /v1/funnels/:id            → one campaign + its stage ladder
//   PATCH  /v1/funnels/:id            → edit
//   DELETE /v1/funnels/:id            → delete, and its counts with it
//   GET    /v1/funnels/:id/ladder     → the report over a date range
//   POST   /v1/funnels/:id/stages     → record one person on one stage
//
// ── The key contract ───────────────────────────────────────────────────────
//   ['funnels']                        the root every read nests under
//   ['funnels','list',{status}]        the list
//   ['funnels','detail', id]           one campaign
//   ['funnels','ladder', id, range]    its report
//
// A write invalidates the ROOT, because editing a stage changes both the
// campaign and the shape of its report.
//
// ── ONE RULE ABOVE ALL OTHERS FOR THE SURFACES THAT READ THIS ──────────────
//
// Every count and every rate here is `number | null`, and **null is never 0**.
// Null means nobody can say: nothing reached the stage above, so a percentage of
// it does not exist; or a stage counts visits to a page that has since been
// deleted. Rendering either as "0%" tells a business their campaign is failing
// when the truth is that it has not been measured. See `rateLabel` below, and
// use it rather than formatting a rate at a call site.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export type FunnelStatus = 'draft' | 'active' | 'paused' | 'archived';
export type FunnelKind = 'lead' | 'recovery' | 'purchase' | 'booking' | 'winback' | 'custom';

/** What a stage DOES, which is not the same as what it is called.
 *  `view` is the only one counted anonymously; everything else is a named person. */
export type StageKind = 'view' | 'capture' | 'qualify' | 'engage' | 'convert';

/** One rung of the ladder. `key` is the stable identity that history is recorded
 *  against, so renaming `name` never orphans past results. */
export interface FunnelStage {
  key: string;
  name: string;
  kind: StageKind;
  /** Which page counts as this stage. `view` stages only. */
  path?: string;
}

export interface Funnel {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  status: FunnelStatus;
  kind: FunnelKind;
  stages: FunnelStage[];
  goal: unknown;
  goalValueCents: string | number | null;
  automationId: string | null;
  sequenceId: string | null;
  entryPageId: string | null;
  entryFormNodeId: string | null;
  /** How long this campaign waits before counting somebody as gone. Null means
   *  it follows `defaultStallHours` for its kind — the two are NOT the same
   *  thing, and the editor has to be able to tell them apart. */
  stallAfterHours: number | null;
  /** What this KIND gives up after when nobody has chosen. Detail responses
   *  only, so the editor can say what "leave it alone" means without mirroring
   *  the platform's defaults table. */
  defaultStallHours?: number;
  recipeKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One rung, with its numbers. See the null rule at the top of this file. */
export interface LadderRung {
  key: string;
  name: string;
  kind: StageKind;
  entered: number | null;
  conversionFromPrevious: number | null;
  conversionFromEntry: number | null;
  valueCents: number;
  path: string | null;
}

export interface Ladder {
  funnelId: string;
  from: string;
  to: string;
  rungs: LadderRung[];
  valueCents: number;
  overallRate: number | null;
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const funnelKeys = {
  root: ['funnels'] as const,
  list: (status?: FunnelStatus) => ['funnels', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['funnels', 'detail', id] as const,
  ladder: (id: string, days: number) => ['funnels', 'ladder', id, days] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useFunnels(status?: FunnelStatus) {
  return useQuery({
    queryKey: funnelKeys.list(status),
    queryFn: () =>
      api.get<Funnel[]>('/v1/funnels', status ? { status } : undefined).then((r) => r ?? []),
  });
}

export function useFunnel(id: string) {
  return useQuery({
    queryKey: funnelKeys.detail(id),
    queryFn: () => api.get<Funnel>(`/v1/funnels/${id}`),
    enabled: id !== 'new',
    // A 404 is an answer, not a fault worth retrying — the campaign was deleted
    // in another pane, or a saved layout is pointing at one that is gone.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** One form the site has, as the picker sees it. */
export interface FormChoice {
  formNodeId: string;
  name: string | null;
  pageSlug: string | null;
}

/**
 * The forms on this site, for choosing what a campaign counts.
 *
 * Gated on the `builder` module server-side, so a tenant without a site gets a
 * 403 rather than an empty list. That is handled as "no forms to offer" rather
 * than as an error: a CRM-only tenant has no site forms and that is a normal
 * state, not a fault worth an alarm on a campaign screen.
 */
export function useSiteForms() {
  return useQuery({
    queryKey: ['forms', 'definitions'],
    queryFn: () =>
      api
        .get<{ forms: FormChoice[] }>('/v1/forms/definitions')
        .then((r) => r?.forms ?? [])
        .catch(() => [] as FormChoice[]),
    staleTime: 60_000,
  });
}

/**
 * What to call a form in a list, in the words its author would use.
 *
 * A form definition carries no name of its own unless somebody typed one, so
 * this falls back to WHERE it is, which is how people refer to their forms
 * anyway ("the one on the contact page"). A null page slug is the home page —
 * the same convention the submit route uses.
 */
export function formChoiceLabel(form: FormChoice): string {
  const where = form.pageSlug ? `/${form.pageSlug.replace(/^\//, '')}` : 'your home page';
  return form.name ? `${form.name} (on ${where})` : `The form on ${where}`;
}

/** The report over a trailing window. `days` is the whole range control: a
 *  campaign is judged over weeks, not between two exact timestamps, and a pair
 *  of date pickers on a report nobody has run yet is friction with no payoff. */
export function useLadder(id: string, days: number) {
  return useQuery({
    queryKey: funnelKeys.ladder(id, days),
    queryFn: () =>
      api.get<Ladder>(`/v1/funnels/${id}/ladder`, {
        from: new Date(Date.now() - days * 86_400_000).toISOString(),
        to: new Date().toISOString(),
      }),
    enabled: id !== 'new',
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface CreateFunnelBody {
  propertyId: string;
  name: string;
  kind: FunnelKind;
  description?: string;
}

export function useCreateFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFunnelBody) => api.post<Funnel>('/v1/funnels', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

export type UpdateFunnelBody = Partial<{
  name: string;
  description: string | null;
  status: FunnelStatus;
  stages: FunnelStage[];
  goal: unknown;
  goalValueCents: number | null;
  entryPageId: string | null;
  entryFormNodeId: string | null;
  stallAfterHours: number | null;
}>;

export function useUpdateFunnel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFunnelBody) => api.patch<Funnel>(`/v1/funnels/${id}`, body),
    // The ROOT, not just this campaign: a stage edit changes the list row's
    // shape and the report at the same time.
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

export function useDeleteFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/v1/funnels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: funnelKeys.root }),
  });
}

/* ── Presentation, shared so both surfaces speak alike ──────────────────── */

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

/** May this viewer create and edit campaigns? (Server bar: editor.) */
export function canEditCampaigns(role: string | undefined): boolean {
  return (ROLE_RANK[role ?? ''] ?? 0) >= 1;
}

export interface StatusMeta {
  label: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  note: string;
}

/**
 * A campaign's status in plain words.
 *
 * The tones carry the one distinction that matters: `active` is the only state
 * that is MEASURING. Draft and paused are both "not counting" and both benign,
 * so neither is an error; archived is retired and says so.
 */
export function statusMeta(status: FunnelStatus): StatusMeta {
  switch (status) {
    case 'active':
      return { label: 'Running', tone: 'success', note: 'Counting people right now.' };
    case 'draft':
      return { label: 'Draft', tone: 'info', note: 'Not counting anyone yet.' };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'warning',
        note: 'Keeping what it already recorded, and not adding to it.',
      };
    default:
      return { label: 'Archived', tone: 'neutral', note: 'Retired. Its results are kept.' };
  }
}

/** What each kind of campaign is for, in the owner's words rather than ours. */
export const KIND_BLURB: Record<FunnelKind, string> = {
  lead: 'Somebody finds you, leaves their details, and becomes a customer.',
  recovery: 'Somebody left something behind and you go and get them.',
  purchase: 'Somebody sees an offer and buys it.',
  booking: 'Somebody looks at your times and books one.',
  winback: 'Somebody who used to buy from you stopped, and you bring them back.',
  custom: 'Your own path, in your own words.',
};

export const KIND_LABEL: Record<FunnelKind, string> = {
  lead: 'Finding new customers',
  recovery: 'Winning back a lost sale',
  purchase: 'Selling something',
  booking: 'Filling the diary',
  winback: 'Bringing people back',
  custom: 'Something else',
};

/**
 * A rate, as a person reads it — or the reason there is no number.
 *
 * THE WHOLE POINT OF THIS FUNCTION. A null rate must never render as 0%. "Nobody
 * has reached the step above this one yet" and "everybody who reached it dropped
 * out" are opposite facts, and 0% claims the second when the truth is the first.
 */
export function rateLabel(rate: number | null): string {
  if (rate === null) return 'Nothing to compare yet';
  return `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;
}

/** A count, or the reason there is not one. Same rule as `rateLabel`. */
export function countLabel(entered: number | null): string {
  return entered === null ? 'Not counted' : entered.toLocaleString();
}

/** Whole pounds/dollars from integer cents. Campaign value is a headline figure
 *  and cents on it are noise. */
/**
 * A span of hours as a person says it: "4 hours", "3 days", "2 weeks".
 *
 * Hours are the storage unit because the sweep works in them; they are a
 * terrible unit to show somebody, since nobody describes a fortnight's patience
 * as 336 hours.
 */
export function hoursLabel(hours: number): string {
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.round(hours / 24);
  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  return days === 1 ? '1 day' : `${days} days`;
}

/** The spans offered in the editor, from an abandoned checkout to a long
 *  win-back silence. Free text was the alternative and it invites "0". */
export const STALL_CHOICES = [4, 12, 24, 48, 72, 168, 336, 720, 1440];

export function moneyLabel(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/** What a stage kind MEANS, for the editor and the ladder legend. */
export const STAGE_KIND_LABEL: Record<StageKind, string> = {
  view: 'Visited a page',
  capture: 'Left their details',
  qualify: 'Told you what they need',
  engage: 'Came back',
  convert: 'Did the thing',
};

export function funnelErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
