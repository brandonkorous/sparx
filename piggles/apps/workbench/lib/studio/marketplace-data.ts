'use client';

// Looks other people made, and bringing one home.
//
// INSTALLING COPIES IT. The listing's token bag becomes a `builder_themes` row of
// the business's own, tagged with which listing it came from and at what version.
// That tag is not decoration — it is what makes "there is a newer version of this
// look" answerable later — but the row is theirs from the moment it lands: editing
// it changes nothing upstream, and nothing upstream changes it.
//
// A pointer would be the other design, and it is the wrong one for a LIVE site: a
// publisher revising their theme would repaint someone's shop with no warning.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import type { Theme } from '@wizeworks/silicaui-html';
import { api } from '../api/client';
import { THEMES_KEY } from './data';

/** One look on the shelf, narrowed to what installing it needs. */
export interface MarketplaceLook {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  version: string;
  publisher: { displayName: string; verified: boolean };
  price: { cents: number; model: string };
  theme: {
    mood: string | null;
    industry: string | null;
    /** The look itself. Null on a listing that resolves by slug rather than by data
     *  — those cannot be installed from here, and the shelf leaves them out. */
    tokens: Record<string, string> | null;
    dark: Record<string, string> | null;
  };
}

export const MARKET_LOOKS_KEY = ['studio', 'market-looks'] as const;

/**
 * The installable looks.
 *
 * A listing with no token bag is FILTERED OUT rather than shown and refused: it is
 * resolved by slug from code, so there is nothing here to copy, and offering a
 * button that cannot work is worse than not offering one.
 */
export function useMarketplaceLooks() {
  return useQuery({
    queryKey: MARKET_LOOKS_KEY,
    queryFn: () =>
      api
        // `limit` because this is a shelf inside a dialog, not the marketplace —
        // someone browsing forty looks should be on the marketplace itself.
        .get<{ items: MarketplaceLook[] }>('/v1/marketplace/themes?limit=24')
        .then((r) => r.items.filter((look) => look.theme.tokens !== null))
        // A failed read means the shelf is empty rather than the dialog broken: the
        // business's OWN looks are the part that matters, and they load separately.
        .catch<MarketplaceLook[]>(() => []),
    staleTime: 300_000,
  });
}

/** The listing as a silica theme — the shape a `builder_themes` row stores. */
export function lookAsTheme(look: MarketplaceLook): Theme {
  return {
    name: look.name,
    tokens: look.theme.tokens ?? {},
    ...(look.theme.dark ? { dark: look.theme.dark } : {}),
  };
}

export interface InstalledTheme {
  id: string;
  name: string;
}

/** Copy a listing into the business's own looks, tagged with where it came from. */
export function useInstallLook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (look: MarketplaceLook) =>
      api.post<InstalledTheme>('/v1/builder/themes', {
        name: look.name,
        theme: lookAsTheme(look),
        origin: 'marketplace',
        marketplaceThemeId: look.id,
        marketplaceVersion: look.version,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: THEMES_KEY });
    },
  });
}
