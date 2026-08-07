// The FIRST-PARTY component catalog — every section sparx ships, as code.
//
// WHY THIS FILE EXISTS. Same reason as first-party-themes.ts, and the components
// shelf shows the failure mode more plainly than the themes one did. A marketplace
// component was a database row put there by an ingest: a generator read
// `SPARX_CATALOG` and wrote bundles to `marketplace-catalog/components/`, and a
// hand-run workflow read those into `marketplace_components`. The source of truth was
// already code — the ingest only COPIED it — so the row bought nothing and cost the
// guarantee that what ships is what's listed.
//
// WHAT IT COST, MEASURED ON PRODUCTION (2026-08-02). 96 rows were being served:
//
//   · 71  the real, current catalog — correct, but present only because someone ran
//         the ingest against that cluster.
//   · 15  PascalCase `BuilderNode` palette pointers (EditorialSection, FeatureGrid,
//         FAQ, Carousel, Stat, Card, Video, Map, Signup, BuyBox, ProductForm,
//         PriceTag, ImageDisplay, NavMenu, SocialLinks) seeded by platform-seed.ts.
//         They carry NO tree, and their "Add" deep-linked to /builder/components/<type>
//         in `apps/dashboard` — an app that no longer exists.
//   · 10  ORPHANS (hero-split, centered-hero, cta-banner, pricing-table,
//         feature-split, testimonial-band, newsletter-band, stats-strip, logo-cloud,
//         team-grid): bundles from an earlier generation, deleted from the repo, still
//         live on the public marketplace. The ingest upserts and never removes, so
//         deleting a bundle cannot delete its row — there is no mechanism that would.
//
// A quarter of the public shelf rendered a grey placeholder instead of a preview, and
// nothing in the repo could have told you which quarter. Components are code now: they
// change when the repo changes, they ship in the image, and a section deleted here
// disappears from the marketplace in the same commit.
//
// WHAT IS STILL A DATABASE ROW. Components published by a TENANT or a PARTNER. Those
// genuinely arrive at runtime, so they stay rows and the adapter serves the union.
//
// EVERY FIELD IS DERIVED, exactly one is authored. A section's `label` is its name and
// its palette `hint` is its tagline — that copy is already written for a non-technical
// owner because the Insert palette shows it, so re-authoring it here would create a
// second version to keep in sync. `GROUP_FACET` below is the single authored table.

import { SPARX_CATALOG } from './catalog';
import type { CatalogGroup, CatalogItem } from './types';
import type { Node } from '@wizeworks/silicaui-html';

/** Catalog group → the browse rail's "Purpose" facet.
 *
 *  The catalog's own group labels ("Helping people choose") read long as a filter
 *  chip and exceed the `group` column's 20-char cap, so each group gets a short one.
 *  Moved here from `marketplace-catalog/_gen/gen-silica-components.ts`, which now
 *  imports it — a group's palette identity and its marketplace facet are edited in
 *  one place. */
export const GROUP_FACET: Record<string, string> = {
  commerce: 'Products',
  sparx_layout: 'Page structure',
  sparx_gallery: 'Pictures',
  sparx_feature: 'Big pictures',
  sparx_compare: 'Comparison',
  sparx_process: 'How it works',
  sparx_people: 'People & proof',
  sparx_place: 'Where & when',
  sparx_convert: 'Get in touch',
  sparx_content: 'Writing',
  sparx_offer: 'Selling',
  sparx_media: 'Video & maps',
  // Added to unblock the suite: another in-flight change introduced the
  // `sparx_publishing` group and this table is what fails when a group has no facet.
  // Taken verbatim from that group's own label (17 chars, inside the 20-char cap) —
  // if its author wants different browse wording, this is the line to change.
  sparx_publishing: 'News and listings',
};

/** Section key → marketplace slug (`product_card` → `product-card`). */
export const componentSlug = (key: string): string => key.replace(/_/g, '-');

/** One first-party component, ready to become a marketplace listing. */
export interface FirstPartyComponent {
  slug: string;
  /** The catalog key the Builder inserts by (`product_card`). */
  key: string;
  name: string;
  tagline: string;
  /** The "Purpose" facet — a `GROUP_FACET` value. */
  group: string;
  kind: string;
  surfaces: string[];
  /** The silica node tree the card renders as a LIVE preview (docs/118), and the
   *  exact tree the Builder inserts. */
  tree: Node;
  sortWeight: number;
}

/** Every section sparx ships, in palette order.
 *
 *  `make()` is called ONCE here, at module load, and the resulting tree is shared by
 *  every listing that serves it. That is safe because a listing is read-only: the
 *  marketplace renders the tree for a preview and never inserts it. The BUILDER still
 *  calls `make()` per insert, which is what keeps inserted nodes id-free and
 *  independent — do not route an insert through this list.
 *
 *  Browse order mirrors the Insert palette (a descending `sortWeight`), so a section
 *  sits in the same place in both. */
export const FIRST_PARTY_COMPONENTS: FirstPartyComponent[] = (() => {
  const flat: { item: CatalogItem; group: CatalogGroup }[] = [];
  for (const group of SPARX_CATALOG) {
    for (const item of group.items) flat.push({ item, group });
  }
  return flat.map(({ item, group }, i) => ({
    slug: componentSlug(item.key),
    key: item.key,
    name: item.label,
    // The palette hint is owner-facing copy already; the label is the honest
    // fallback for a section that ships without one.
    tagline: item.hint ?? item.label,
    group: GROUP_FACET[group.key] ?? group.label,
    kind: 'Section',
    surfaces: ['page'],
    tree: item.make(),
    sortWeight: flat.length - i,
  }));
})();

const BY_SLUG = new Map(FIRST_PARTY_COMPONENTS.map((c) => [c.slug, c]));

export function firstPartyComponent(slug: string): FirstPartyComponent | undefined {
  return BY_SLUG.get(slug);
}

/** True when a slug belongs to sparx, and so must not be shadowed by a database row
 *  — the same guard `isFirstPartyThemeSlug` provides for themes. */
export function isFirstPartyComponentSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}
