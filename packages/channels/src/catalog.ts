// Channel catalog — the server-safe descriptor list the dashboard + marketplace
// render from WITHOUT importing adapter code (mirrors @sparx/dropship's
// VENDOR_CATALOG split). Pure data; no I/O. The full platform set + shapes are
// the locked decision C2 in docs/106 §3.
//
// `availability` reflects whether the adapter has shipped + its partner app is
// approved (docs/106 §7). At P0 (framework only) every channel is `coming_soon`;
// each flips to `available` when its adapter is registered in a later phase.

import type { ChannelShape, ChannelSlug } from './types.js';

export interface ChannelDescriptor {
  slug: ChannelSlug;
  name: string;
  shape: ChannelShape;
  /** Marketing one-liner for the connect card. */
  tagline: string;
  /** Full order management (bidirectional) vs catalog-out feed only. */
  managesOrders: boolean;
  /** Best-fit note shown in the catalog. */
  bestFor: string;
  /** Build phase from docs/106 §6 (for ordering + "coming in P_" copy). */
  phase: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  availability: 'available' | 'coming_soon';
}

export const CHANNEL_CATALOG: readonly ChannelDescriptor[] = [
  {
    slug: 'google_shopping',
    name: 'Google Shopping',
    shape: 'feed',
    tagline: 'Free organic product listings across Google Search and Shopping.',
    managesOrders: false,
    bestFor: 'Everyone — auto-enroll, drives traffic to your site',
    phase: 'P1',
    availability: 'coming_soon',
  },
  {
    slug: 'meta',
    name: 'Meta (Instagram & Facebook)',
    shape: 'feed',
    tagline: 'Sync your catalog to Instagram and Facebook Shops and tag products in posts.',
    managesOrders: false,
    bestFor: 'Every SMB — social discovery + ads',
    phase: 'P1',
    availability: 'coming_soon',
  },
  {
    slug: 'pinterest',
    name: 'Pinterest',
    shape: 'feed',
    tagline: 'Turn your products into shoppable Pins for high-intent browsers.',
    managesOrders: false,
    bestFor: 'Fashion, home, and food',
    phase: 'P1',
    availability: 'coming_soon',
  },
  {
    slug: 'tiktok_shop',
    name: 'TikTok Shop',
    shape: 'order',
    tagline: 'Sell directly in-app; orders, inventory, and fulfillment sync both ways.',
    managesOrders: true,
    bestFor: 'Social-impulse and modern SMB brands',
    phase: 'P2',
    availability: 'coming_soon',
  },
  {
    slug: 'etsy',
    name: 'Etsy',
    shape: 'order',
    tagline: 'List on Etsy and manage orders and stock from one place.',
    managesOrders: true,
    bestFor: 'Handmade, vintage, craft, and supplies',
    phase: 'P3',
    availability: 'coming_soon',
  },
  {
    slug: 'walmart',
    name: 'Walmart Marketplace',
    shape: 'order',
    tagline: 'Reach the second-largest US marketplace with synced listings and orders.',
    managesOrders: true,
    bestFor: 'General merchandise, home, electronics',
    phase: 'P3',
    availability: 'coming_soon',
  },
  {
    slug: 'ebay',
    name: 'eBay',
    shape: 'order',
    tagline: 'List on eBay and keep inventory and orders in sync.',
    managesOrders: true,
    bestFor: 'Auto parts, industrial, refurbished, collectibles',
    phase: 'P3',
    availability: 'coming_soon',
  },
  {
    slug: 'faire',
    name: 'Faire',
    shape: 'order',
    tagline: 'Sell wholesale to retailers; pairs with your B2B account pricing.',
    managesOrders: true,
    bestFor: 'Brands selling wholesale to retailers',
    phase: 'P3',
    availability: 'coming_soon',
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    shape: 'order',
    tagline: 'List on the highest-volume marketplace, with FBM and FBA support.',
    managesOrders: true,
    bestFor: 'High-volume brands and dropship sellers',
    phase: 'P4',
    availability: 'coming_soon',
  },
  {
    slug: 'sparx_market',
    name: 'sparx.market',
    shape: 'first_party',
    tagline: 'List on the sparx marketplace — we process payment and settle to you.',
    managesOrders: true,
    bestFor: 'Cross-tenant discovery with zero payment setup',
    phase: 'P5',
    availability: 'coming_soon',
  },
] as const;

/** Look up a channel descriptor by slug. */
export function getChannelDescriptor(slug: ChannelSlug): ChannelDescriptor | undefined {
  return CHANNEL_CATALOG.find((c) => c.slug === slug);
}

/** The slugs that are live to connect today (adapter shipped + partner approved). */
export const AVAILABLE_CHANNEL_SLUGS: readonly ChannelSlug[] = CHANNEL_CATALOG.filter(
  (c) => c.availability === 'available'
).map((c) => c.slug);
