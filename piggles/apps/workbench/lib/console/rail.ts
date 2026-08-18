'use client';

// What this business keeps on its rail.
//
// ── WHY THIS IS NOT MODULE STATE ────────────────────────────────────────────
//
// Piggles includes every app on every plan (piggles/CLAUDE.md RULE #2), so a
// module flag cannot carry this: turning one off to tidy the rail would take the
// app's workers, routes and rows down with it. "Not on my rail" and "I did not
// buy this" are different sentences, and only the second is sparx's.
//
// The rail used to be derived from module flags, and it worked for one commit:
// onboarding activated only the modules behind the ticked groups, so the flags
// happened to describe the rail. That gate was removed — correctly, it made the
// unticked apps locked doors — and nothing replaced the hiding it was doing.
// This is the replacement.
//
// ── TENANT, NOT PERSON ──────────────────────────────────────────────────────
//
// "This business does not take bookings" is a fact about the business, so every
// teammate sees the same rail and only an owner or admin changes it. The
// per-person layer is Favourites and Recent on the /v1/me spine, plus the access
// gate — a teammate restricted to Invoices still sees less than the owner does.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '@/lib/api/client';

export const RAIL_KEY = ['tenant', 'rail'];

/** `apps: null` means this business has never chosen, which reads as "show
 *  everything" — never as an empty rail. */
interface RailPreference {
  apps: string[] | null;
}

/** The app that cannot be put away: Home is where the checklist, the attention
 *  counts and the way back live. */
const PINNED = 'home';

export function useRailPreference() {
  return useQuery({
    queryKey: RAIL_KEY,
    queryFn: () => api.get<RailPreference>('/v1/tenant/rail'),
    staleTime: 300_000,
  });
}

export function useSetRailApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apps: string[]) =>
      api.put<RailPreference>('/v1/tenant/rail', { apps: [...new Set([PINNED, ...apps])] }),
    // Written straight into the cache rather than invalidated: the rail redraws
    // from this, and a refetch round-trip would leave the app the person just
    // added missing for as long as it takes.
    onSuccess: (next) => {
      queryClient.setQueryData(RAIL_KEY, next);
    },
  });
}

/** Whether an app is on the rail, for a preference that may not exist yet. */
export function isOnRail(appId: string, chosen: string[] | null | undefined): boolean {
  if (appId === PINNED) return true;
  if (!chosen) return true;
  return chosen.includes(appId);
}
