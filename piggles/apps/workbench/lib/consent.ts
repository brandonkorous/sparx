'use client';

// Reads the analytics consent decision. Does not, and cannot, make one.
//
// ── WHY THIS FILE NO LONGER OWNS A COOKIE ───────────────────────────────────
//
// It used to. The console ran PostHog, so the console asked — a banner over the
// workspace — and the answer went into a host-only cookie on mypiggles.com. Two
// things were wrong with that, and the second is the one that mattered:
//
//   1. Somebody reached their business BEFORE being asked. The first thing a new
//      customer saw of the product they had just signed up for was a consent bar
//      across the bottom of it.
//   2. It was asked on the wrong domain. A Piggles customer deals with WizeWorks
//      on getpiggles.com — subscription, details, and this. mypiggles.com is
//      where they run their business, which is a different relationship, and the
//      split between the two is the whole reason those are two apps.
//
// So the question moved to getpiggles.com — answered in passing at signup, or at
// /handoff, which will not open the door to this app without a record. The
// ANSWER moved with it, onto `users.preferences.consent`, because three
// registrable domains cannot share a cookie and an account can be read from all
// of them. This app now only reads it.
//
// ── WHY "NO ANSWER" IS ITS OWN STATE AND NEVER FALLS BACK ───────────────────
//
// `null` means nobody has been asked, and it is NOT the same as `false`. It
// cannot arise on a normal path — the door guarantees a record — so seeing it
// here means a request failed, a record is malformed, or somebody arrived by a
// route that skipped the gate. Every one of those is a reason to run nothing.
// The tracker starts on `true` and on nothing else.
//
// ── WHAT IS DELIBERATELY NOT GATED ──────────────────────────────────────────
//
// `piggles_active_property` — it exists only for a signed-in operator, holds the
// id of one of their OWN sites, and is what makes the workspace open where they
// left it. That is the service working as asked for rather than something done
// to them, so it is strictly necessary. It is still listed on
// meetpiggles.com/cookies: "not asked about" and "not disclosed" are very
// different things.

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
const PREFERENCES_KEY = ['me', 'preferences'] as const;

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
