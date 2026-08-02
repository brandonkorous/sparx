import type { ImageResponse } from 'next/og';
import { BRAND, MODULE_HEX, type ModuleKey } from '@sparx/brand';
import { renderSimpleOg } from '@/lib/og-simple';
import { fetchPartner, partnerLocation, TIER_META } from '@/lib/partners';
import { specialty } from '../directory/_components/specialties';

// The share card for one partner, rendered per slug from their name, tier,
// location and specialties. Lives here rather than in opengraph-image.tsx
// because Next needs `opengraph-image` and `twitter-image` to be two separate
// route modules, and the card itself is the same picture in both.
//
// Satori cannot resolve CSS custom properties, so this is one of the two
// sanctioned literal-hex contexts in the repo — and it reads the hexes from
// @sparx/brand rather than typing them, so a brand or module hue change reaches
// the share cards along with everything else.

/**
 * The accent is the partner's FIRST specialty's module hue, not a blanket Ember
 * — the same rule the directory cards follow, where someone who builds
 * storefronts is orange and someone who does CRM is cyan. Falls back to the
 * brand primary when the specialty has no module behind it (`migration`), or
 * when none is listed.
 */
function accentFor(specialties: string[]): string {
  for (const s of specialties) {
    const color = specialty(s).color;
    if (!color.startsWith('module-')) continue;
    const hex = MODULE_HEX[color.slice('module-'.length) as ModuleKey];
    if (hex) return hex;
  }
  return BRAND.primary;
}

export async function renderPartnerOg(slug: string): Promise<ImageResponse> {
  const p = await fetchPartner(slug);
  if (!p) {
    return renderSimpleOg({
      tag: 'Partner directory',
      accent: BRAND.primary,
      title: 'Find someone to build it with you',
      footerRight: 'sparx.works/partners/directory',
    });
  }

  const where = partnerLocation(p);
  const work = p.specialties
    .slice(0, 4)
    .map((s) => specialty(s).label)
    .join(' · ');

  return renderSimpleOg({
    tag: `${TIER_META[p.tier].label} partner`,
    accent: accentFor(p.specialties),
    title: p.displayName,
    subtitle: work || undefined,
    footerLeft: where ?? undefined,
    footerRight: `sparx.works/partners/${p.slug}`,
  });
}
