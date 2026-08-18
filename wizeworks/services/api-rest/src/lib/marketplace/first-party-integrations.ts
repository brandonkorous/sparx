// The first-party integration listings — DERIVED from the shared integration plane,
// not authored.
//
// WHAT AN INTEGRATION LISTING IS. Discovery, and only discovery (docs/60 §6, docs/66
// MP-Ph3). The card exists so a tenant browsing the marketplace can find that sparx
// talks to a service; its CTA hands off to the Integrations panel, where the real
// connect flow lives. Nothing here configures, authenticates or runs anything, which
// is why `configSchema` stays NULL — the schema belongs to the integration and is
// read at connect time.
//
// WHY THIS IS NOW DERIVED. It used to be a hand-written list of six, under a note
// explaining why generating it was impossible. Both reasons were true when written
// and are now gone:
//
//   · "ProviderMetadataDescriptor has no tagline or sortWeight — those are marketplace
//     copy, not provider facts." The shared `IntegrationDescriptor` carries `blurb`
//     and `sortWeight`, because every surface needed them, not just this one.
//   · "the registry is populated by side effect and nothing imports the providers in
//     api-rest, so listProviders() is empty here." `bootstrapIntegrations()` now
//     imports and registers every category at boot, in one place, precisely so that is
//     no longer true.
//
// The cost of the hand-written version was never the typing. It advertised six
// integrations while the platform had thirty-one; it listed `stripe` pointing at a
// `@sparx/provider-stripe` package that never existed; and it had no way to notice
// either, because nothing connected the list to the thing it described. A derived list
// cannot drift: an integration is on the shelf when it is registered, and gone when it
// is not.
//
// PUBLISHER SCOPING. Only `sparx`-published descriptors are emitted here. A
// contributor's uploaded integration lands in the same `marketplace_integrations`
// table through the same columns under THEIR publisher id, and the publisher-scoped
// prune leaves it alone — the same "one shelf, many publishers" contract that themes,
// components and blueprints already run on.

import {
  categoryInfo,
  listIntegrationDescriptors,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

export interface FirstPartyIntegration {
  slug: string;
  name: string;
  /** Resolves the real adapter at connect time. Category-qualified, because a slug is
   *  unique only WITHIN a category — `meta` is both a sales channel and a social
   *  account, and they are different integrations. */
  providerSlug: string;
  /** The card's category label — human copy ("Card payments"), taken from the same
   *  category definition the Integrations panel renders, so the two cannot disagree. */
  kind: string;
  scopes: string[];
  accent: string;
  tagline: string;
  description: string;
  sortWeight: number;
}

/** The card's accent chip, keyed on CATEGORY rather than vendor — so the shelf reads
 *  as a set of related things instead of a wall of borrowed brand colors, and a
 *  contributor's integration inherits the right chip without supplying one. */
const CATEGORY_ACCENT: Record<string, string> = {
  payments: '#f97316',
  shipping: '#0891b2',
  tax: '#65a30d',
  sales_channels: '#7c2d12',
  social: '#be123c',
  dropship: '#0369a1',
  ai: '#4f46e5',
};

const ACCENT_FALLBACK = '#6b7280';

function toListing(descriptor: IntegrationDescriptor): FirstPartyIntegration {
  const info = categoryInfo(descriptor.category);
  return {
    // Category-qualified so two categories can each carry a `meta` or a `pinterest`
    // without colliding on the marketplace's unique slug.
    slug: `${descriptor.category}-${descriptor.slug}`,
    name: descriptor.name,
    providerSlug: `${descriptor.category}:${descriptor.slug}`,
    kind: info.label,
    // Capabilities double as the listing's scopes — they are already the plain-language
    // statement of what connecting this lets sparx do.
    scopes: [...descriptor.capabilities],
    accent: CATEGORY_ACCENT[descriptor.category] ?? ACCENT_FALLBACK,
    tagline: descriptor.blurb,
    description: descriptor.blurb,
    sortWeight: descriptor.sortWeight ?? 0,
  };
}

/**
 * Every sparx-published integration, as marketplace listings.
 *
 * A function rather than a constant: the plane is populated at boot by
 * `bootstrapIntegrations()`, so a module-level constant would capture an empty
 * registry at import time — exactly the failure the old header predicted.
 *
 * `coming_soon` entries ARE included. The marketplace's job is to say what sparx will
 * talk to; the panel is where a control gets disabled and explains itself. Omitting
 * them is what kept four finished bundles invisible for months.
 */
export function firstPartyIntegrations(): FirstPartyIntegration[] {
  return listIntegrationDescriptors()
    .filter((d) => d.publisher === 'sparx')
    .map(toListing);
}
