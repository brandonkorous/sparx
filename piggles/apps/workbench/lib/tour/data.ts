'use client';

// Where an answer is kept: the `tour` branch of the per-user preferences blob,
// through the merge-patch endpoint that already serves it. No new table, no new
// endpoint — the server preserves keys it does not own.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../api/client';
import type { GuideKey, GuideOutcome, GuidePrefs } from './types';

interface PreferencesResponse {
  tour?: GuidePrefs;
}

/** Shared with the consent reader, so one request answers both and neither can
 *  hold a staler view than the other. */
const PREFERENCES_KEY = ['me', 'preferences'] as const;

export function useGuidePrefs() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<PreferencesResponse>('/v1/me/preferences'),
    staleTime: 60_000,
  });
}

/** Remember how the shell guide went.
 *
 *  Deliberately does not invalidate: a guide that is still running holds its own
 *  position, and refetching underneath it would only churn. The cache is updated
 *  in place so the next reader sees the truth without a round trip. */
export function useSaveWelcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (welcome: GuideOutcome) => api.patch('/v1/me/preferences', { tour: { welcome } }),
    onSuccess: (_data, welcome) => {
      queryClient.setQueryData<PreferencesResponse>(PREFERENCES_KEY, (prev) => ({
        ...(prev ?? {}),
        tour: { ...(prev?.tour ?? {}), welcome },
      }));
    },
  });
}

/** Remember how ONE app's guide went. Patches only that key; the server deep-
 *  merges the tour branch, so this never disturbs the shell answer or another
 *  app's. */
export function useSaveAppGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, outcome }: { key: GuideKey; outcome: GuideOutcome }) =>
      api.patch('/v1/me/preferences', { tour: { modules: { [key]: outcome } } }),
    onSuccess: (_data, { key, outcome }) => {
      queryClient.setQueryData<PreferencesResponse>(PREFERENCES_KEY, (prev) => ({
        ...(prev ?? {}),
        tour: {
          ...(prev?.tour ?? {}),
          modules: { ...(prev?.tour?.modules ?? {}), [key]: outcome },
        },
      }));
    },
  });
}
