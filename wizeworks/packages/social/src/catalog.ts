// The social platform catalog — server-safe DISPLAY metadata (name, blurb, rollout
// phase) for every platform sparx will publish to (docs/133, docs/134). NO adapter
// import here, so the composer UI can render the connect cards without pulling any
// network code (mirrors @wizeworks/channels' `catalog.ts`).
//
// `availability` is NOT baked in — the API resolves it at runtime against the live
// registry + env (a platform is connectable only when its adapter is registered, its
// OAuth app is configured, and SOCIAL_TOKEN_KEY is set), so a platform lights up the
// instant ops provisions its approved app, with no code change.

import type { SocialPlatform } from './types.js';

/** Which build phase a platform ships in — shown in the UI so an un-shipped platform
 *  reads as "coming in Phase 2", not "broken". */
export type SocialPlatformPhase = 'v1' | 'Phase 2' | 'Phase 3';

export interface SocialPlatformDescriptor {
  platform: SocialPlatform;
  name: string;
  /** One plain line: what connecting this does, for a non-technical owner. */
  blurb: string;
  phase: SocialPlatformPhase;
}

export const SOCIAL_CATALOG: SocialPlatformDescriptor[] = [
  {
    platform: 'google_business',
    name: 'Google Business Profile',
    blurb: 'Post updates, offers, and news straight to your Google Business listing.',
    phase: 'v1',
  },
  {
    platform: 'linkedin',
    name: 'LinkedIn',
    blurb: 'Share posts to your company page for customers and partners to see.',
    phase: 'v1',
  },
  {
    platform: 'facebook_page',
    name: 'Facebook Page',
    blurb: 'Publish posts to your Facebook Page.',
    phase: 'Phase 2',
  },
  {
    platform: 'instagram',
    name: 'Instagram',
    blurb: 'Share photos and videos to your Instagram business account.',
    phase: 'Phase 2',
  },
  {
    platform: 'threads',
    name: 'Threads',
    blurb: 'Post text updates to Threads.',
    phase: 'Phase 2',
  },
  {
    platform: 'x',
    name: 'X',
    blurb: 'Post to your X (Twitter) account.',
    phase: 'Phase 3',
  },
  {
    platform: 'tiktok',
    name: 'TikTok',
    blurb: 'Publish videos and photo posts to TikTok.',
    phase: 'Phase 3',
  },
  {
    platform: 'pinterest',
    name: 'Pinterest',
    blurb: 'Create Pins from your images.',
    phase: 'Phase 3',
  },
  {
    platform: 'youtube',
    name: 'YouTube',
    blurb: 'Publish Shorts — short vertical videos — to your YouTube channel.',
    phase: 'Phase 3',
  },
];

const BY_PLATFORM = new Map(SOCIAL_CATALOG.map((d) => [d.platform, d]));

export function getSocialDescriptor(
  platform: SocialPlatform
): SocialPlatformDescriptor | undefined {
  return BY_PLATFORM.get(platform);
}
