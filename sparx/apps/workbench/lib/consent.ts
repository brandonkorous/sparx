'use client';

// Reads the analytics consent decision, and nothing else.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// The workbench runs PostHog: autocapture, pageviews, web vitals, and an
// `identify` carrying first-touch attribution. All of it used to start on mount,
// for everybody, guarded only by the build mode and the presence of a key —
// neither of which is consent. Nobody was ever asked, so there was no answer to
// respect, and there was no way for an operator who did not want to be measured
// to say so.
//
// ── WHY THE ANSWER IS ON THE ACCOUNT AND NOT IN A COOKIE ────────────────────
//
// Because a person's decision should follow the person. The workbench is one of
// several places a sparx operator meets us — the marketing site, an emailed
// report, a popped-out pane in a second window — and a host-only cookie answers
// for exactly one of them and forgets the moment somebody clears it.
//
// It rides `users.preferences`, the per-user JSON blob that already carries view
// defaults and tour outcomes, and the endpoint that serves it preserves keys it
// does not own. So this needed no migration, no table and no new read endpoint.
//
// ── THREE STATES, AND NEVER A FALLBACK ──────────────────────────────────────
//
// `null` means nobody has been asked, and it is NOT the same as `false`. The two
// look identical in a boolean and mean opposite things about what we owe the
// person: `false` is a decision to respect, `null` is a question still to ask.
// Collapsing them is how somebody ends up either measured without being asked or
// never asked at all.
//
// A failed read also reads as `null`. The tracker starts on `true` and on
// nothing else — analytics beginning a moment late costs a few events, and
// beginning unasked costs the thing consent is for.
//
// ── WHAT IS DELIBERATELY NOT GATED ──────────────────────────────────────────
//
// `sparx_active_property` — it exists only for a signed-in operator, holds the
// id of one of their OWN sites, and is what makes the workspace open where they
// left it. That is the service working as asked rather than something done to
// them, so it is strictly necessary. It is still listed on the cookies page:
// "not asked about" and "not disclosed" are very different things.

import { useQuery } from '@wizeworks/query';
import { api } from './api/client';

/** The `consent` branch of GET /v1/me/preferences. `null` when no decision is on
 *  record — the server sends `null` for both "absent" and "malformed", because
 *  neither is an answer. */
export interface ConsentRecord {
  analytics: boolean;
  at: string;
}

interface PreferencesResponse {
  consent?: ConsentRecord | null;
}

/** Shares the react-query cache key with the tour's reader, so the one request
 *  serves both and a write on either stays coherent. */
export const PREFERENCES_KEY = ['me', 'preferences'] as const;

/** The recorded decision.
 *
 *  `undefined` while it is being fetched, `null` if there is none, otherwise the
 *  record. Three states, and callers must distinguish all three — collapsing the
 *  first two into "false" is harmless, collapsing either into "true" is not. */
export function useConsent(): ConsentRecord | null | undefined {
  const { data, isPending } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<PreferencesResponse>('/v1/me/preferences'),
    staleTime: 60_000,
    // A failed read must not resolve to a grant. Retrying is fine — the worst
    // case is that analytics starts a moment later than it could have, which is
    // the direction this is allowed to be wrong in.
    retry: 1,
  });
  if (isPending) return undefined;
  return data?.consent ?? null;
}

/** True only when analytics is affirmatively granted. Loading and "never asked"
 *  both read as false, which is the safe direction for both. */
export function useAnalyticsGranted(): boolean {
  return useConsent()?.analytics === true;
}
