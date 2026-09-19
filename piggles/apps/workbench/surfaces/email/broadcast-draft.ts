'use client';

// The editable shape of a broadcast, and the small pure helpers both faces of
// the pane share: what is still missing before it can go out, and how a date is
// spelled for a person.

import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { Audience, Broadcast, DesignedEmail, EmailSettings } from './broadcasts-data';

export const DETAIL_KEY = 'email.broadcasts.detail';
export const SETTINGS_KEY = 'email.settings';
export const EMAIL_DESIGNER_KEY = 'builder.email';

/** One centred, capped column. A pane torn onto a second monitor is otherwise
 *  2000px of dead grey with the form pinned to the left edge. */
export const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export interface Draft {
  name: string;
  subject: string;
  preheader: string;
  segmentId: string;
  builderEmailId: string;
}

export function draftFrom(broadcast: Broadcast | undefined): Draft {
  return {
    name: broadcast?.name ?? '',
    subject: broadcast?.subject ?? '',
    preheader: broadcast?.preheader ?? '',
    segmentId: broadcast?.segmentId ?? '',
    builderEmailId: broadcast?.builderEmailId ?? '',
  };
}

export function serialize(draft: Draft): string {
  return [draft.name, draft.subject, draft.preheader, draft.segmentId, draft.builderEmailId].join(
    '\u0000'
  );
}

/** A `datetime-local` value a few minutes ahead — the earliest sensible schedule
 *  and the default the picker opens on. Local wall-clock, not UTC, so the value
 *  matches what the operator sees on their own clock. */
export function soonLocalValue(): string {
  const when = new Date(Date.now() + 15 * 60 * 1000);
  const offsetMs = when.getTimezoneOffset() * 60 * 1000;
  return new Date(when.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** A timestamp in full, plain words — "12 March 2026 at 9:00 am". */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "a, b and c" — a plain-language list for the "still needs …" hint. */
export function formatList(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;
}

/** Everything a real send needs that this draft has not got. Each missing piece
 *  names itself, so the Send button being off is never a mystery. */
// Moved to `broadcast-ready.ts`, which imports nothing, because one of these
// rules is a legal one and a file importing the surface registry cannot be
// reached from the node test seat. Re-exported so the call sites read the same.
export { hasMailingAddress, missingPieces } from './broadcast-ready';
export type { MailingAddress, ReadinessFacts } from './broadcast-ready';
/** How many people, said in words — "23 people", "1 person". */
export function peopleCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'person' : 'people'}`;
}

/** Everything the composer's fields read. The pane owns the state and the
 *  writes; the field groups are given this and render. */
export interface ComposeBodyProps {
  ctx: SurfaceContext;
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  audiences: { items: Audience[]; isError: boolean; isSuccess: boolean };
  designed: { items: DesignedEmail[]; isError: boolean; isSuccess: boolean };
  settings: EmailSettings | undefined;
  settingsPending: boolean;
  recipientCount: number | undefined;
  estimatePending: boolean;
  emailUnpublished: boolean;
  missing: string[];
  timing: 'now' | 'schedule';
  setTiming: (next: 'now' | 'schedule') => void;
  scheduledAt: string;
  setScheduledAt: (next: string) => void;
  scheduleValid: boolean;
  /** The saved broadcast's id, or null while it has never been saved. The
   *  preview renders the SERVER's copy, so it needs one. */
  savedId: string | null;
  dirty: boolean;
}
