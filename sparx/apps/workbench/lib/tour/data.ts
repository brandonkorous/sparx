'use client';

// Tour persistence — reads/writes the `tour` branch of the per-user
// `users.preferences` blob through the existing merge-patch endpoint
// (GET/PATCH /v1/me/preferences). No new table, no new endpoint: the server
// preserves keys it doesn't own, so a one-key `{ tour: { welcome } }` patch lands
// alongside the view defaults already there. See docs/132 §2.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../api/client';
import type { TourModule, TourOutcome, TourPrefs } from './types';

/** The slice of `/v1/me/preferences` this feature reads. Other keys (view
 *  defaults, notification prefs) are present in the response but ignored here. */
interface PreferencesResponse {
  tour?: TourPrefs;
}

const PREFERENCES_KEY = ['me', 'preferences'] as const;

/** The user's saved tour outcomes. Shares the react-query cache key with any
 *  other preferences reader, so a write here and a view-default write stay
 *  coherent. */
export function useTourPrefs() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<PreferencesResponse>('/v1/me/preferences'),
    staleTime: 60_000,
  });
}

/** Persist the welcome tour's outcome. Deliberately does NOT invalidate the
 *  preferences query: the in-flight tour holds its own state, and refetching
 *  mid-tour would only churn. The next full load reads the fresh value. */
export function useSaveTourOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (welcome: TourOutcome) => api.patch('/v1/me/preferences', { tour: { welcome } }),
    onSuccess: (_data, welcome) => {
      // Keep the local cache in step without a network round-trip.
      queryClient.setQueryData<PreferencesResponse>(PREFERENCES_KEY, (prev) => ({
        ...(prev ?? {}),
        tour: { ...(prev?.tour ?? {}), welcome },
      }));
    },
  });
}

/** Persist ONE module's tier-2 tour outcome. Patches only `tour.modules[<slug>]`;
 *  the server deep-merges the tour branch, so this never disturbs the welcome
 *  outcome or another module's. Same no-invalidate stance as the welcome saver —
 *  the offer card and any running tour hold their own state. */
export function useSaveModuleTourOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, outcome }: { module: TourModule; outcome: TourOutcome }) =>
      api.patch('/v1/me/preferences', { tour: { modules: { [module]: outcome } } }),
    onSuccess: (_data, { module, outcome }) => {
      queryClient.setQueryData<PreferencesResponse>(PREFERENCES_KEY, (prev) => ({
        ...(prev ?? {}),
        tour: {
          ...(prev?.tour ?? {}),
          modules: { ...(prev?.tour?.modules ?? {}), [module]: outcome },
        },
      }));
    },
  });
}
