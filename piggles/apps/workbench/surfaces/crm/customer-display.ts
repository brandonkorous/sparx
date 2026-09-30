'use client';

// How a customer is NAMED, CLASSIFIED and FORMATTED for display.
//
// Split from the data layer because it is a different job: nothing here fetches
// or writes anything. The three classification axes are the console's vocabulary
// for what a contact IS, and the formatters are how their figures read.
//
// The axes are three ORTHOGONAL questions (docs/137), and keeping them apart is
// the point: `type` is how they transact, `lifecycleStage` is where they are in
// the journey, `leadStatus` is the micro work-state of a lead.

import type { CustomerType, LeadStatus, LifecycleStage } from '@wizeworks/crm-schemas';
import { formatAmount } from '../../lib/money-format';

/** The best human name for a customer — real name, else company, else email,
 *  else a plain fallback. Never an empty string, so a row is never blank. */
export function customerName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (c.company?.trim()) return c.company.trim();
  if (c.email?.trim()) return c.email.trim();
  return 'Unnamed contact';
}

/**
 * A name somebody typed into a picker, split into the two boxes the form has.
 *
 * The reverse of `customerName`, and it exists for one moment: she searched
 * for a person who is not in the book yet, so the name is already typed and
 * making her type it again is how the same person ends up in there twice
 * (issue 745).
 *
 * Everything before the LAST space is the first name. "Mary Jane Vale" is
 * "Mary Jane" and "Vale", not "Mary" and "Jane Vale", because a surname is
 * one word far more often than a first name is. One word is a first name and
 * no surname; both boxes stay editable, so a wrong guess costs a click.
 */
export function splitTypedName(typed: string): { firstName: string; lastName: string } {
  const words = typed.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: words[0] ?? '', lastName: '' };
  const lastName = words.pop() ?? '';
  return { firstName: words.join(' '), lastName };
}

interface AxisMeta {
  label: string;
  /**
   * A REGISTERED color name, as spelled in the app's `@plugin` block — module
   * hues are `module-<slug>`, not `<slug>`.
   *
   * This is a plain `string` because silica's own `SilicaColor` is
   * `… | (string & {})`, so nothing here can be caught by the compiler. An
   * unregistered name emits no class at all and the component falls back to
   * grey, which looks like a deliberate choice and is why Wholesale and
   * Individual read identically for months (issue 747). `check:colors` is the
   * thing that actually catches it.
   */
  color: string;
  description: string;
}

/* ── Axis 1: relationship type (`type`) ─────────────────────────────────────
 * How a contact transacts. `b2b` (Wholesale) is the one kind with behaviour —
 * trade pricing + A/R — so it is only offered when the B2B module is on (the
 * caller gates it); the rest are label-only. */
export const RELATIONSHIP_TYPES: CustomerType[] = ['retail', 'b2b', 'partner', 'vendor'];

export function customerTypeMeta(type: CustomerType): AxisMeta {
  switch (type) {
    case 'retail':
      return {
        label: 'Individual',
        color: 'module-commerce',
        description: 'A regular customer at your standard prices.',
      };
    case 'b2b':
      return {
        label: 'Wholesale',
        color: 'module-b2b',
        description: 'A business you supply, at the prices you agreed with them.',
      };
    case 'partner':
      return {
        label: 'Partner',
        color: 'accent',
        description: 'A referral, affiliate, or reseller you work with.',
      };
    case 'vendor':
      return {
        label: 'Vendor',
        color: 'neutral',
        description: 'A supplier you buy from.',
      };
  }
}

/* ── Axis 2: lifecycle stage (`lifecycleStage`) ─────────────────────────────
 * Where the contact is in the journey — the primary "where are they" signal.
 * A completed order advances them to `customer` automatically. Ordered as the
 * ladder progresses. */
export const LIFECYCLE_STAGES: LifecycleStage[] = [
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
  'other',
];

export function lifecycleStageMeta(stage: LifecycleStage): AxisMeta {
  switch (stage) {
    case 'subscriber':
      return {
        label: 'Subscriber',
        color: 'neutral',
        description: 'Opted in to hear from you (a newsletter or updates), nothing more yet.',
      };
    case 'lead':
      return {
        label: 'Lead',
        color: 'info',
        description: 'Made contact or inquired, beyond just subscribing.',
      };
    case 'marketing_qualified_lead':
      return {
        label: 'Marketing qualified',
        color: 'primary',
        description: 'Marketing judged them ready to hand to sales.',
      };
    case 'sales_qualified_lead':
      return {
        label: 'Sales qualified',
        color: 'primary',
        description: 'Sales judged them a real potential customer.',
      };
    case 'opportunity':
      return {
        label: 'Opportunity',
        color: 'warning',
        description: 'Has an open deal in progress.',
      };
    case 'customer':
      return {
        label: 'Customer',
        color: 'success',
        description: 'Has at least one completed order.',
      };
    case 'evangelist':
      return {
        label: 'Evangelist',
        color: 'accent',
        description: 'A customer who actively advocates for you.',
      };
    case 'other':
      return {
        label: 'Other',
        color: 'neutral',
        description: "Doesn't fit the ladder.",
      };
  }
}

/* ── Axis 3: lead status (`leadStatus`) ─────────────────────────────────────
 * The micro work-state — what someone is doing about this contact right now.
 * Only meaningful while a lead is being worked, so it can be unset. */
export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'open',
  'in_progress',
  'open_deal',
  'unqualified',
  'attempted_to_contact',
  'connected',
  'bad_timing',
];

export function leadStatusMeta(status: LeadStatus): AxisMeta {
  switch (status) {
    case 'new':
      return { label: 'New', color: 'info', description: 'Not worked yet.' };
    case 'open':
      return { label: 'Open', color: 'info', description: 'Being worked.' };
    case 'in_progress':
      return { label: 'In progress', color: 'primary', description: 'Actively in conversation.' };
    case 'open_deal':
      return { label: 'Open deal', color: 'success', description: 'A deal is on the table.' };
    case 'unqualified':
      return { label: 'Unqualified', color: 'neutral', description: 'Not a fit right now.' };
    case 'attempted_to_contact':
      return {
        label: 'Attempted to contact',
        color: 'warning',
        description: 'Reached out, no reply yet.',
      };
    case 'connected':
      return { label: 'Connected', color: 'success', description: 'Two-way contact made.' };
    case 'bad_timing':
      return { label: 'Bad timing', color: 'neutral', description: 'Interested, but not now.' };
  }
}

/** Money for display. Accepts the wire string or a number; `—` when unknown. */
export function formatMoney(value: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return formatAmount(n, currency);
}

/** Two letters for a monogram, from whatever identity is present — name, then
 *  company, then email — so a chip is never an empty circle. Takes the loose
 *  shape so it serves both a saved `Customer` and an in-progress edit draft. */
export function customerInitials(c: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
}): string {
  const first = c.firstName?.trim() ?? '';
  const last = c.lastName?.trim() ?? '';
  const fromName = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
  if (fromName) return fromName;
  // company, then email — `.find(Boolean)` picks the first non-empty (a trimmed
  // blank must fall through, which `??` would not do), so no `||` on strings.
  const fallback = [c.company, c.email].map((value) => value?.trim()).find(Boolean) ?? '';
  return fallback ? fallback.slice(0, 2).toUpperCase() : '?';
}

/** A full, spelled-out date — for facts someone might quote ("first order"). */
export function longDate(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Month + year — the resolution "customer since" actually wants. */
export function joinedMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** How long ago an order was, in words a person actually uses — days, weeks,
 *  months, years. Recency is the signal that says whether a customer is still
 *  active, so it is worth saying properly rather than as a raw date. */
export function describeOrderRecency(iso: string | null): string {
  if (!iso) return 'No orders yet';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No orders yet';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'a week ago' : `${String(weeks)} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'a month ago' : `${String(months)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'a year ago' : `${String(years)} years ago`;
}
