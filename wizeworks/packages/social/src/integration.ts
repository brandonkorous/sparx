// Social accounts' entry in the shared integration plane (@wizeworks/integrations).
//
// `SocialAdapter` keeps its own contract and its own dispatch — the worker still
// resolves an adapter and calls `publish`/`getMetrics` against the real type. What
// moves here is the catalog face, so connecting an Instagram account and connecting a
// payment processor are the same errand in the same place.
//
// Social already had the idea this plane generalises: `isPlatformConnectable()` is
// "registered AND its OAuth app is configured", which is exactly
// `needs_platform_setup` under a local name. It is spelled the shared way here so
// every category gets it, rather than the three that happened to invent it.

import {
  defineIntegrationKind,
  type IntegrationAvailability,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

import { SOCIAL_CATALOG, type SocialPlatformDescriptor } from './catalog.js';
import type { SocialAdapter } from './types.js';

export const socialIntegrations = defineIntegrationKind<SocialAdapter>('social');

/** Whose account the tenant is actually connecting. */
function vendorFor(platform: string): string {
  switch (platform) {
    case 'facebook_page':
    case 'instagram':
    case 'threads':
      return 'Meta';
    case 'google_business':
    case 'youtube':
      return 'Google';
    case 'linkedin':
      return 'LinkedIn';
    case 'x':
      return 'X';
    case 'tiktok':
      return 'TikTok';
    case 'pinterest':
      return 'Pinterest';
    default:
      return platform;
  }
}

function resolveAvailability(
  descriptor: SocialPlatformDescriptor,
  adapter: SocialAdapter | undefined
): { availability: IntegrationAvailability; reason?: string } {
  if (!adapter) {
    return {
      availability: 'coming_soon',
      reason: `Posting to ${descriptor.name} is on the way. We will let you know the moment you can connect it.`,
    };
  }
  if (!adapter.isConfigured()) {
    return {
      availability: 'needs_platform_setup',
      reason: `sparx is finishing its ${descriptor.name} app approval. Nothing for you to do — this will switch on by itself.`,
    };
  }
  return { availability: 'available' };
}

/** What connecting the account gets you, from the platform's own constraints — so the
 *  catalog never claims a capability the adapter does not have. */
function capabilityPhrases(adapter: SocialAdapter | undefined): string[] {
  const phrases = ['Publish posts from sparx', 'See how each post performed'];
  const media = adapter?.constraints.supportedMedia ?? [];
  if (media.includes('video')) phrases.push('Photos and video');
  else if (media.includes('image')) phrases.push('Photos');
  if (adapter?.constraints.requiresMedia) phrases.push('Every post needs a photo or video');
  return phrases;
}

export function socialToIntegrationDescriptor(
  descriptor: SocialPlatformDescriptor,
  adapter: SocialAdapter | undefined
): IntegrationDescriptor {
  const { availability, reason } = resolveAvailability(descriptor, adapter);
  return {
    category: 'social',
    slug: descriptor.platform,
    name: descriptor.name,
    vendor: vendorFor(descriptor.platform),
    blurb: descriptor.blurb,
    publisher: 'sparx',
    availability,
    unavailableReason: reason,
    // Always OAuth — a tenant approves sparx against their own account; nothing is typed.
    connect: 'oauth',
    credentialFields: [],
    capabilities: capabilityPhrases(adapter),
    // The v1 platforms lead, because they are the ones a tenant can finish today.
    sortWeight: descriptor.phase === 'v1' ? 100 : descriptor.phase === 'Phase 2' ? 10 : 0,
  };
}

/** Publish every platform in the catalog into the shared plane, pairing each with its
 *  registered adapter when one exists. */
export function registerSocialIntegrations(
  lookup: (platform: SocialPlatformDescriptor['platform']) => SocialAdapter | undefined
): void {
  for (const descriptor of SOCIAL_CATALOG) {
    const adapter = lookup(descriptor.platform);
    socialIntegrations.register(socialToIntegrationDescriptor(descriptor, adapter), adapter);
  }
}
