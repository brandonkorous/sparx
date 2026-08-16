'use client';

// The studio's reads and writes — one document at a time.
//
// No whole-site call anywhere here. A theme, a layout and a page each load and
// save on their own, which is the whole reason the panes can be open together
// without fighting over one draft.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import type { Theme } from '@wizeworks/silicaui-html';
import { api } from '../api/client';

export const THEMES_KEY = ['studio', 'themes'] as const;
export const PRESETS_KEY = ['studio', 'theme-presets'] as const;
export const SELECTION_KEY = ['studio', 'theme-selection'] as const;

export interface ThemeRow {
  id: string;
  name: string;
  origin: 'custom' | 'preset' | 'marketplace';
  sourceKey: string | null;
  marketplaceThemeId: string | null;
  marketplaceVersion: string | null;
  draft: Theme;
  published: Theme | null;
  publishedAt: string | null;
  unpublished: boolean;
  updatedAt: string;
}

/** One shelf of ready-made looks, as the platform ships them. */
export interface PresetGroup {
  key: string;
  label: string;
  themes: Theme[];
}

export interface ThemeSelection {
  themeId: string | null;
  publishedThemeId: string | null;
}

export function useThemes() {
  return useQuery({
    queryKey: THEMES_KEY,
    queryFn: () => api.get<{ themes: ThemeRow[] }>('/v1/builder/themes').then((r) => r.themes),
    staleTime: 30_000,
  });
}

export function useThemePresets() {
  return useQuery({
    queryKey: PRESETS_KEY,
    queryFn: () =>
      api.get<{ groups: PresetGroup[] }>('/v1/builder/themes/presets').then((r) => r.groups),
    // Shipped in the image — it cannot change while the tab is open.
    staleTime: Infinity,
  });
}

export function useThemeSelection() {
  return useQuery({
    queryKey: SELECTION_KEY,
    queryFn: () => api.get<ThemeSelection>('/v1/builder/themes/selection'),
    staleTime: 30_000,
  });
}

/** Everything that changes the theme LIST, sharing one invalidation. Generic over
 *  the RESULT as well as the input — collapsing it to `unknown` is how a caller
 *  ends up casting the row it just saved. */
function useThemeListMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: THEMES_KEY });
    },
  });
}

export function useCreateTheme() {
  return useThemeListMutation(
    (input: { name: string; theme: Theme; origin?: string; sourceKey?: string }) =>
      api.post<ThemeRow>('/v1/builder/themes', input)
  );
}

export function useDuplicateTheme() {
  return useThemeListMutation((input: { id: string; name?: string }) =>
    api.post<ThemeRow>(`/v1/builder/themes/${input.id}/duplicate`, { name: input.name })
  );
}

export function useDeleteTheme() {
  return useThemeListMutation((id: string) => api.delete(`/v1/builder/themes/${id}`));
}

/** Save one theme's draft. Explicit — nothing here autosaves. */
export function useSaveTheme() {
  return useThemeListMutation((input: { id: string; name: string; theme: Theme }) =>
    api.patch<ThemeRow>(`/v1/builder/themes/${input.id}`, { name: input.name, theme: input.theme })
  );
}

export function usePublishTheme() {
  return useThemeListMutation((id: string) =>
    api.post<ThemeRow>(`/v1/builder/themes/${id}/publish`)
  );
}

/** Point this site at a look — the DRAFT pointer; visitors see it on publish. */
export function useApplyTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string | null) =>
      api.put<ThemeSelection>('/v1/builder/themes/selection', { themeId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SELECTION_KEY });
    },
  });
}

/** Which sites wear a look — asked before deleting or replacing one. */
export function useThemeUsages(id: string | null) {
  return useQuery({
    queryKey: ['studio', 'theme-usages', id],
    queryFn: () =>
      api
        .get<{ sites: { propertyId: string }[] }>(`/v1/builder/themes/${id}/usages`)
        .then((r) => r.sites),
    enabled: Boolean(id),
  });
}
