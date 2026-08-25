// Acquisition presentation for the operator console (docs/80 §10) — how a
// channel, source, or campaign reads on screen.
//
// ── THE COLOR CARRIES THE ECONOMICS, SO THE TABLE DOESN'T NEED A COLUMN ─────
//
// The first question anybody asks of a channel report is not "what is this
// channel called", it is "did we PAY for these signups?". So that is what the
// badge hue says: paid channels are `warning`, earned ones `success`, the ones
// we own outright `primary`. An operator scanning the table sees the paid/earned
// mix before reading a single label — which is why there is no "Type" column
// next to the name. The color IS that column.
//
// `mcp_ai` is the exception and deliberately so: traffic arriving through an AI
// client is the AI · MCP module's own functionality showing up in the acquisition
// report, so it wears that module's hue via a nested `ModuleProvider` rather than
// a semantic tone.

import type { SparxModule } from '@wizeworks/ui';

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

/** Channels we pay per acquisition for. */
const PAID = new Set(['paid_search', 'paid_social', 'display', 'affiliate']);
/** Channels earned rather than bought. */
const EARNED = new Set(['organic_search', 'organic_social', 'community', 'referral']);
/** Channels we own the audience of. */
const OWNED = new Set(['email', 'direct']);

/** The `(unknown)` bucket the summary uses for signups with no channel recorded. */
export const UNATTRIBUTED = '(unknown)';

const CHANNEL_LABELS: Record<string, string> = {
  direct: 'Direct',
  organic_search: 'Organic search',
  paid_search: 'Paid search',
  organic_social: 'Organic social',
  paid_social: 'Paid social',
  display: 'Display',
  referral: 'Referral',
  email: 'Email',
  affiliate: 'Affiliate',
  community: 'Community',
  mcp_ai: 'AI · MCP',
  internal: 'Internal',
  [UNATTRIBUTED]: 'Not measured',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/**
 * `danger` for the un-attributed bucket is a judgement, not decoration: a signup
 * whose origin was never captured is the one number this report exists to shrink,
 * and it cannot be recovered later. Showing it in the same tone as a measured
 * channel would let it read as a channel called "unknown" rather than as a hole
 * in the measurement.
 */
export function channelTone(channel: string): Tone {
  if (channel === UNATTRIBUTED) return 'danger';
  if (PAID.has(channel)) return 'warning';
  if (EARNED.has(channel)) return 'success';
  if (OWNED.has(channel)) return 'primary';
  if (channel === 'internal') return 'secondary';
  return 'info';
}

/** True when the channel should render through `<ModuleProvider>` instead of a
 *  semantic tone — AI · MCP traffic is a module's functionality, not a tone. */
export function channelModule(channel: string): SparxModule | null {
  return channel === 'mcp_ai' ? 'ai' : null;
}

/** Share of a total as a whole-ish percentage string, or null when there is no
 *  denominator. Never returns "0%" for an empty total — no denominator means no
 *  share, which is a different statement. */
export function sharePct(part: number, total: number): string | null {
  if (total <= 0) return null;
  const pct = (part / total) * 100;
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}
