'use client';

// What each builder is allowed to offer, and the live regions the platform fills in.
//
// A layout is a header and a footer. Offering it a pricing table and a testimonial
// carousel is not generosity — it is two hundred choices where about twenty are
// right, and the twenty that are right are the ones the author came for. So a
// layout's palette keeps the primitives, the navbars, the footers and the blocks
// that genuinely live in chrome, and leaves the storytelling to the page builder.
// Nothing is lost: everything hidden here is one pane away, where it belongs.
//
// Host cores are the other half. They are the parts the PLATFORM keeps filled in —
// the brand mark, the cart, the search results — and they reach the palette from the
// registry rather than the catalog, so without this group an author could not put a
// shopping cart on their own site at all.

import type { PaletteGroup, PaletteItem } from '@wizeworks/silicaui-builder/react';
import type { CatalogScope } from '@wizeworks/studio/react';
import type { DocumentKind } from '@wizeworks/studio';
import { HOST_COMPONENTS, SITE_CATALOG, SPARX_CATALOG, hostCore } from '@wizeworks/silica-catalog';

/**
 * The sparx-catalog blocks a LAYOUT may use, by group.
 *
 * An ALLOWLIST, not a block list, and deliberately: a section added to the catalog
 * next month is page content until somebody decides it belongs in a header. A group
 * absent from this map is page content in its entirety.
 */
const CHROME_BLOCKS: Record<string, string[]> = {
  // An announcement bar above the header; a contact strip and a set of onward links
  // in the footer. The rest of this group is page body.
  sparx_layout: ['notice_banner', 'contact_strip', 'onward_links'],
  // Where to find us and when we are open — footer staples for a real business.
  sparx_place: ['opening_hours', 'find_us'],
  // The one conversion block that belongs in a footer.
  sparx_convert: ['newsletter_signup'],
  // A map or an embed in the footer.
  sparx_media: ['map_embed', 'other_embed'],
};

/** The host-core categories a LAYOUT may place. The others are page-sized live
 *  regions — a whole cart, a whole search — and putting one in the chrome would put
 *  it on every page of the site. */
const CHROME_CORE_CATEGORIES = ['Your site', 'Your media'];

/**
 * The page-shaped items inside silica's own Sections group.
 *
 * That group holds the navbars and footers a layout is built from AND the heroes and
 * pricing tables it is not, so it is scoped item by item rather than dropped whole —
 * hiding it entirely would take the header with it.
 */
const PAGE_ONLY_BLOCKS = [
  'block:hero_split_cta',
  'block:hero_centered',
  'block:hero_spotlight',
  'block:hero_signup',
  'block:hero_statement',
  'block:feature_grid',
  'block:feature_media',
  'block:feature_alternating',
  'block:feature_bento',
  'block:feature_checklist',
  'block:logo_cloud',
  'block:stats_band',
  'block:testimonial_quote',
  'block:testimonials_grid',
  'block:testimonial_carousel',
  'block:testimonial_logos',
  'block:testimonial_portrait',
  'block:pricing_tiers',
  'block:pricing_toggle',
  'block:pricing_duo',
  'block:pricing_single',
  'block:pricing_table',
  'block:faq_accordion',
  'block:content_prose',
  'block:team_grid',
  'block:cta_band',
  'block:cta_split',
  'block:cta_card',
  'block:cta_signup',
  'block:cta_inline',
];

/** The live regions, grouped the way the registry groups them. */
export function hostCoreGroups(categories?: readonly string[]): PaletteGroup[] {
  const byCategory = new Map<string, PaletteItem[]>();
  for (const core of HOST_COMPONENTS) {
    if (categories && !categories.includes(core.category)) continue;
    const items = byCategory.get(core.category) ?? [];
    items.push({
      key: `host:${core.key}`,
      label: core.label,
      icon: core.icon as PaletteItem['icon'],
      hint: core.hint,
      make: () => hostCore(core.key),
    });
    byCategory.set(core.category, items);
  }
  return [...byCategory].map(([label, items]) => ({
    key: `piggles_host_${label.toLowerCase().replace(/\W+/g, '_')}`,
    label,
    items,
  }));
}

/** The sparx catalog, narrowed to what belongs in chrome. Groups with nothing left
 *  are dropped rather than shown empty. */
function chromeCatalog(groups: readonly PaletteGroup[]): PaletteGroup[] {
  const out: PaletteGroup[] = [];
  for (const group of groups) {
    const keep = CHROME_BLOCKS[group.key];
    if (!keep) continue;
    const items = group.items.filter((item) => keep.includes(item.key));
    if (items.length > 0) out.push({ ...group, items });
  }
  return out;
}

/**
 * What this document may insert.
 *
 * The commerce composites AND the section library AND the host cores — a host that
 * reaches for only some of them ships a builder with no galleries, no price list, no
 * opening hours or no cart, and nothing about the omission is visible until an author
 * goes looking for a block that is not there.
 */
export function catalogFor(kind: DocumentKind): CatalogScope {
  // `CatalogGroup` and `PaletteGroup` are the same shape either side of the package
  // boundary; the catalog is typed in sparx's terms and the palette in silica's.
  const sparx = [...SPARX_CATALOG, ...SITE_CATALOG] as unknown as PaletteGroup[];
  if (kind !== 'layout') {
    return { extend: [...sparx, ...hostCoreGroups()] };
  }
  return {
    extend: [...chromeCatalog(sparx), ...hostCoreGroups(CHROME_CORE_CATEGORIES)],
    hide: PAGE_ONLY_BLOCKS,
  };
}
