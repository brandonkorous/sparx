// Per-platform posting constraints (docs/133 §4, §8).
//
// The SINGLE source of truth for "what fits on this platform", shared by the composer
// (author-time preview + validation) and the worker's pre-publish guard. Values are
// each platform's published posting limits as of authoring; when a platform changes a
// limit, it changes HERE, in one place, and every surface follows.
//
// These are the ORGANIC-post limits (the v1 scope), not ad-creative limits. Numbers
// are deliberately a touch conservative where a platform documents a soft ceiling —
// the goal is to catch a post that will be REJECTED, not to police style.

import type { PlatformConstraints, SocialPlatform } from './types.js';

export const PLATFORM_CONSTRAINTS: Record<SocialPlatform, PlatformConstraints> = {
  facebook_page: {
    maxTextLength: 63206,
    maxMediaCount: 10,
    supportedMedia: ['image', 'video'],
    requiresMedia: false,
    aspectRatios: ['1:1', '4:5', '16:9'],
  },
  instagram: {
    // A caption is capped at 2,200 chars; a feed post cannot be text-only.
    maxTextLength: 2200,
    maxMediaCount: 10, // carousel
    supportedMedia: ['image', 'video'],
    requiresMedia: true,
    aspectRatios: ['1:1', '4:5', '9:16'],
  },
  threads: {
    maxTextLength: 500,
    maxMediaCount: 10,
    supportedMedia: ['image', 'video'],
    requiresMedia: false,
    aspectRatios: ['1:1', '4:5'],
  },
  linkedin: {
    maxTextLength: 3000,
    maxMediaCount: 9,
    supportedMedia: ['image', 'video'],
    requiresMedia: false,
    aspectRatios: ['1:1', '1.91:1'],
  },
  google_business: {
    // A Google Business Profile post caps at 1,500 chars and takes one photo.
    maxTextLength: 1500,
    maxMediaCount: 1,
    supportedMedia: ['image'],
    requiresMedia: false,
    aspectRatios: ['4:3'],
  },
  x: {
    // Base tier; the renderer counts the body only (a link is a separate field —
    // adapters that inline it account for the ~23-char t.co cost themselves).
    maxTextLength: 280,
    maxMediaCount: 4,
    supportedMedia: ['image', 'video'],
    requiresMedia: false,
    aspectRatios: ['16:9', '1:1'],
  },
  tiktok: {
    // Caption limit; a TikTok post is media-first (a video, or a photo carousel).
    maxTextLength: 2200,
    maxMediaCount: 35, // photo mode
    supportedMedia: ['image', 'video'],
    requiresMedia: true,
    aspectRatios: ['9:16'],
  },
  pinterest: {
    // A Pin needs an image; the description caps at 500 chars.
    maxTextLength: 500,
    maxMediaCount: 1,
    supportedMedia: ['image', 'video'],
    requiresMedia: true,
    aspectRatios: ['2:3'],
  },
  youtube: {
    // YouTube has no public API for Community text posts; the adapter uploads SHORTS
    // (vertical short videos) via the Data API, so a YouTube post needs a video. The
    // title caps at 100 chars but the description (what a post body maps to) allows 5k.
    maxTextLength: 5000,
    maxMediaCount: 1,
    supportedMedia: ['video'],
    requiresMedia: true,
    aspectRatios: ['9:16'],
  },
};

/** The constraints for a platform. Throws on an unknown platform (a programmer error
 *  — the union is closed), never returns a silent default that would let an
 *  unvalidated post through. */
export function constraintsFor(platform: SocialPlatform): PlatformConstraints {
  const c = PLATFORM_CONSTRAINTS[platform];
  if (!c) throw new Error(`No posting constraints defined for platform "${platform}".`);
  return c;
}
