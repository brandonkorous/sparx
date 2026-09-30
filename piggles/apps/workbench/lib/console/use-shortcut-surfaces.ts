'use client';

// The person's own two lists, resolved to surfaces they can actually reach.
//
// ONE gate, shared by the rail and the panel that opens either list up. The rail
// used to test `listed` and the module by hand and never asked
// `productHidesSurface`, so a surface Piggles does not have could still get in by
// being favorited or simply opened once — which is how "Modules" came to sit
// under Recent on a product with no module pricing. Two callers reading the same
// hook is what stops that returning through the second one.

import { useMemo } from 'react';
import { useFavorites, useRecents } from '@/lib/api/shell-data';
import { getSurface, type SurfaceDefinition } from '@/lib/surfaces/registry';
import {
  surfaceIsVisible,
  useKnownModules,
  useReachableModules,
} from '@/lib/surfaces/use-visible-nav';

export interface ShortcutSurfaces {
  favorites: SurfaceDefinition[];
  /** Favorites are already pinned above, so showing them again here is noise. */
  recents: SurfaceDefinition[];
}

export function useShortcutSurfaces(): ShortcutSurfaces {
  const { data: favorites } = useFavorites();
  const { data: recents } = useRecents();
  const reachable = useReachableModules();
  const known = useKnownModules();

  return useMemo(() => {
    const resolve = (actionId: string): SurfaceDefinition | null => {
      const definition = getSurface(actionId);
      if (!definition || definition.listed === false) return null;
      if (!surfaceIsVisible(definition, reachable, known)) return null;
      return definition;
    };

    const favoriteSurfaces = (favorites ?? [])
      .map((favorite) => resolve(favorite.actionId))
      .filter((definition): definition is SurfaceDefinition => definition !== null);

    const favoriteKeys = new Set(favoriteSurfaces.map((definition) => definition.key));

    return {
      favorites: favoriteSurfaces,
      recents: (recents ?? [])
        .map((recent) => resolve(recent.actionId))
        .filter(
          (definition): definition is SurfaceDefinition =>
            definition !== null && !favoriteKeys.has(definition.key)
        ),
    };
  }, [favorites, recents, reachable, known]);
}
