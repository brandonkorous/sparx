// Tenant-branded fallback OG card (docs/50 §5). Builds the URL for the `/api/og`
// generator route. Used ONLY when an entity has no real image of its own — a
// product photo, collection hero, or author-set `og_image` always wins. The URL
// is relative; it resolves to an absolute URL on the tenant origin via the
// layout's `metadataBase`, so the social crawler fetches it from the right host.
//
// No label above the title. It printed `PAGE`, `HOME` or `SITE` in tracked capitals
// over a journal's headline (P09): the platform's word for what the thing is, which
// tells someone scrolling past a shared link nothing, and is the eyebrow root
// CLAUDE.md RULE #2 bans. The title and the business's name carry the card.

import { platformBrandIdentity } from '@wizeworks/brand-core';

const MAX_TITLE = 120;
const MAX_BRAND = 60;

export interface OgCardParams {
  /** The headline — product/page/collection title. */
  title: string;
  /** Store display name, rendered as the card's footer signature. */
  brand?: string;
  /** Tenant brand color (#rrggbb). */
  accent?: string | null;
  /**
   * Which product this tenant signed up under, for the accent to fall back to
   * when the tenant has set no color of their own.
   *
   * Resolved HERE and sent as a parameter, because the generator is an edge
   * route that performs no lookup by design — so its own fallback was a literal
   * sparx Ember, painting the top edge of a Piggles business's social card in
   * another company's color whenever that business had not picked one.
   */
  platformBrand?: string | null;
}

export function ogImageUrl({ title, brand, accent, platformBrand }: OgCardParams): string {
  const p = new URLSearchParams();
  p.set('title', title.slice(0, MAX_TITLE));
  if (brand) p.set('brand', brand.slice(0, MAX_BRAND));
  const hex =
    normalizeHex(accent) ??
    (platformBrand ? normalizeHex(platformBrandIdentity(platformBrand).accentHex) : null);
  if (hex) p.set('accent', hex);
  return `/api/og?${p.toString()}`;
}

// Accept "#rrggbb" or "rrggbb"; return the bare 6 hex digits (no `#`, so it
// survives URL encoding cleanly). Anything else → null (route uses its default).
function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return m?.[1] ?? null;
}
