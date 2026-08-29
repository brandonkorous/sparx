// How both surfaces speak about a campaign, so they speak alike.

import type { FunnelKind, FunnelStatus, StageKind } from './types';

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

/** May this person create and edit campaigns? (Server bar: editor.) */
export function canEditCampaigns(role: string | undefined): boolean {
  return (ROLE_RANK[role ?? ''] ?? 0) >= 1;
}

export interface StatusMeta {
  label: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  note: string;
}

/** A campaign's state in plain words. `active` is the only one MEASURING;
 *  draft and paused are both benign, so neither is an error. */
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

export const KIND_LABEL: Record<FunnelKind, string> = {
  lead: 'Finding new customers',
  recovery: 'Winning back a lost sale',
  purchase: 'Selling something',
  booking: 'Filling the diary',
  winback: 'Bringing people back',
  custom: 'Something else',
};

export const KIND_BLURB: Record<FunnelKind, string> = {
  lead: 'Somebody finds you, leaves their details, and becomes a customer.',
  recovery: 'Somebody left something behind and you go and get them.',
  purchase: 'Somebody sees an offer and buys it.',
  booking: 'Somebody looks at your times and books one.',
  winback: 'Somebody who used to buy from you stopped, and you bring them back.',
  custom: 'Your own path, in your own words.',
};

export const STAGE_KIND_LABEL: Record<StageKind, string> = {
  view: 'Visited a page',
  capture: 'Left their details',
  qualify: 'Told you what they need',
  engage: 'Came back',
  convert: 'Did the thing',
};

/**
 * A rate as a person reads it, or the reason there is no number.
 *
 * A null rate must never render as 0%: "nobody reached the step above" and
 * "everybody dropped out" are opposite facts, and 0% claims the second.
 */
export function rateLabel(rate: number | null): string {
  if (rate === null) return 'Nothing to compare yet';
  return `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;
}

/** A count, or the reason there is not one. Same rule as `rateLabel`. */
export function countLabel(entered: number | null): string {
  return entered === null ? 'Not counted' : entered.toLocaleString();
}

/** Whole currency from integer cents — cents on a headline figure are noise. */
/**
 * A span of hours as a person says it: "4 hours", "3 days", "2 weeks".
 *
 * Hours are the storage unit because the sweep works in them, and a terrible
 * unit to show anybody: nobody calls a fortnight 336 hours.
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

/** The spans offered in the editor. Free text was the alternative, and it
 *  invites "0". */
export const STALL_CHOICES = [4, 12, 24, 48, 72, 168, 336, 720, 1440];

export function moneyLabel(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * What to call a form in a list, in the words its author would use.
 *
 * A form definition carries no name of its own unless somebody typed one, so
 * this falls back to WHERE it is, which is how people refer to their forms
 * anyway ("the one on the contact page"). A null page slug is the home page —
 * the same convention the submit route uses.
 */
export function formChoiceLabel(form: { name: string | null; pageSlug: string | null }): string {
  const where = form.pageSlug ? `/${form.pageSlug.replace(/^\//, '')}` : 'your home page';
  return form.name ? `${form.name} (on ${where})` : `The form on ${where}`;
}
