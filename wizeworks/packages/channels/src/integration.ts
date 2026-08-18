// Sales channels' entry in the shared integration plane (@wizeworks/integrations).
//
// `ChannelAdapter` keeps its own contract and its own dispatch — the sync worker still
// resolves an adapter by slug and calls `pushProduct`/`fetchOrders` against the real
// type. What moves here is the catalog face, so "places you sell" lists in the same
// panel as payments, shipping and social rather than only under commerce.
//
// This is also where the three availability states earn their keep. A channel has two
// independent reasons it might not be connectable, and they have different audiences:
// the adapter may not have shipped yet (`coming_soon`, ours to fix), or it shipped and
// sparx has not provisioned its partner OAuth app (`needs_platform_setup`, ops to fix,
// and it lights up on the next boot with no code change). Collapsing both into one
// "unavailable" is what left four provider bundles invisible for months.

import {
  defineIntegrationKind,
  type IntegrationAvailability,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

import { CHANNEL_CATALOG, type ChannelDescriptor } from './catalog.js';
import type { ChannelAdapter, ChannelSlug } from './types.js';

export const channelIntegrations = defineIntegrationKind<ChannelAdapter>('sales_channels');

/** Who runs the channel — shown as "by …" so a tenant can tell whose terms they are
 *  agreeing to. sparx.market is ours; the rest are other people's marketplaces. */
function vendorFor(slug: string): string {
  switch (slug) {
    case 'sparx_market':
      return 'sparx';
    case 'google_shopping':
      return 'Google';
    case 'meta':
      return 'Meta';
    case 'tiktok_shop':
      return 'TikTok';
    case 'amazon':
      return 'Amazon';
    case 'walmart':
      return 'Walmart';
    case 'ebay':
      return 'eBay';
    case 'etsy':
      return 'Etsy';
    case 'faire':
      return 'Faire';
    case 'pinterest':
      return 'Pinterest';
    default:
      return slug;
  }
}

/**
 * Resolve the honest availability for one channel.
 *
 * Evaluated at registration, which runs at boot after env is loaded — the same moment
 * the old per-request `isConfigured()` check would have seen the same answer. A channel
 * whose credentials arrive later lights up on the next roll, which is what "no code
 * change" already meant.
 */
function resolveAvailability(
  descriptor: ChannelDescriptor,
  adapter: ChannelAdapter | undefined
): { availability: IntegrationAvailability; reason?: string } {
  // A REGISTERED ADAPTER IS THE AUTHORITY, not the catalog's `availability` column.
  //
  // That column was written when the adapters were unbuilt — its own comment says
  // "At P0 every channel is coming_soon; each flips to available when its adapter is
  // registered in a later phase." The adapters all shipped; nobody went back to flip
  // ten booleans. Reading it first made all ten channels claim sparx had not built
  // them yet, which is both wrong and the WORSE of the two failure modes: it hides
  // finished work behind a state the tenant reads as "not coming any time soon."
  //
  // Adapter presence answers "did we build it"; `isConfigured()` answers "has ops
  // provisioned the partner app". Between them the state is always live, so nothing
  // has to be hand-maintained — which is the whole reason the stale column existed.
  if (!adapter) {
    return {
      availability: 'coming_soon',
      reason: `Support for ${descriptor.name} is on the way. We will let you know the moment you can connect it.`,
    };
  }
  if (!adapter.isConfigured()) {
    return {
      availability: 'needs_platform_setup',
      reason: `sparx is finishing its ${descriptor.name} partner approval. Nothing for you to do — this will switch on by itself.`,
    };
  }
  return { availability: 'available' };
}

function capabilityPhrases(descriptor: ChannelDescriptor): string[] {
  return descriptor.managesOrders
    ? ['Lists your products', 'Brings orders into sparx', 'Keeps stock in step']
    : ['Lists your products', 'Shoppers check out on your own site'];
}

export function channelToIntegrationDescriptor(
  descriptor: ChannelDescriptor,
  adapter: ChannelAdapter | undefined
): IntegrationDescriptor {
  const { availability, reason } = resolveAvailability(descriptor, adapter);
  return {
    category: 'sales_channels',
    slug: descriptor.slug,
    name: descriptor.name,
    vendor: vendorFor(descriptor.slug),
    blurb: descriptor.tagline,
    publisher: 'sparx',
    availability,
    unavailableReason: reason,
    // Every channel is OAuth — a tenant authorises sparx against their own seller
    // account; no key is ever typed into a form.
    connect: 'oauth',
    credentialFields: [],
    capabilities: capabilityPhrases(descriptor),
    // sparx.market first (we can actually connect it end to end), then the channels
    // that carry orders, then feeds.
    sortWeight: descriptor.slug === 'sparx_market' ? 100 : descriptor.managesOrders ? 10 : 0,
  };
}

/** Publish every channel in the catalog into the shared plane, pairing each with its
 *  registered adapter when one exists. Keyed on `ChannelSlug` rather than `string` so
 *  the registry's own accessor drops straight in as the lookup. */
export function registerChannelIntegrations(
  lookup: (slug: ChannelSlug) => ChannelAdapter | undefined
): void {
  for (const descriptor of CHANNEL_CATALOG) {
    const adapter = lookup(descriptor.slug);
    channelIntegrations.register(channelToIntegrationDescriptor(descriptor, adapter), adapter);
  }
}
