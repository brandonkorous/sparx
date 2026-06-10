/**
 * Deterministic channel classifier (docs/80 §5.4). Pure function: same inputs
 * always yield the same {@link Channel}. Order of precedence:
 *   1. explicit utm_medium  →  2. ad click id  →  3. referrer host / agent UA  →  4. direct
 */
import type { Channel, ClickIds } from './types';
import {
  AGENT_MARKERS,
  CLICK_ID_TO_CHANNEL,
  FORUM_HOSTS,
  MEDIUM_TO_CHANNEL,
  SEARCH_ENGINE_HOSTS,
  SOCIAL_HOSTS,
  isUtmMedium,
  normalizeToken,
} from './taxonomy';

export interface ClassifyInput {
  medium?: string | null;
  source?: string | null;
  clickIds?: ClickIds | null;
  /** Host only (e.g. `news.ycombinator.com`), lowercased internally. */
  referrerHost?: string | null;
  userAgent?: string | null;
}

function hostMatches(host: string, needles: readonly string[]): boolean {
  return needles.some((n) => host.includes(n));
}

export function classify(input: ClassifyInput): Channel {
  // 1. Explicit medium wins.
  if (input.medium) {
    const medium = normalizeToken(input.medium);
    if (isUtmMedium(medium)) return MEDIUM_TO_CHANNEL[medium];
  }

  // 2. A click id implies paid.
  if (input.clickIds) {
    for (const [key, value] of Object.entries(input.clickIds)) {
      const channel = CLICK_ID_TO_CHANNEL[key];
      if (value && channel) return channel;
    }
  }

  // 3. Agent traffic → mcp_ai; otherwise classify by referrer host.
  const ua = input.userAgent?.toLowerCase() ?? '';
  if (ua && AGENT_MARKERS.some((marker) => ua.includes(marker))) return 'mcp_ai';

  const host = input.referrerHost?.toLowerCase() ?? '';
  if (host) {
    if (AGENT_MARKERS.some((marker) => host.includes(marker))) return 'mcp_ai';
    if (hostMatches(host, SEARCH_ENGINE_HOSTS)) return 'organic_search';
    if (hostMatches(host, FORUM_HOSTS)) return 'community';
    if (hostMatches(host, SOCIAL_HOSTS)) return 'organic_social';
    return 'referral';
  }

  // 4. No signal → direct.
  return 'direct';
}
