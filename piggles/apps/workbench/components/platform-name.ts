// WHICH MARK A PLATFORM NAME DRAWS.
//
// The artwork lives next door in `platform-mark.tsx`. This is the NAME side of
// it, split out for two reasons.
//
// TWO VOCABULARIES FOR ONE SET OF COMPANIES. A CONNECTED ACCOUNT is a Facebook
// *Page* (`facebook_page`), because that is the thing the API posts to. A link
// the owner types into her own footer is just "facebook". Both end up in front
// of the same drawing, so the mapping has to live somewhere, and somewhere is
// here rather than at each call site.
//
// AND IT DECIDES WHETHER A LINK DRAWS AT ALL. Get a name wrong and the mark
// quietly falls back to printing the raw word in a footer — legible, but not what
// anybody chose. The console's test seat is `environment: 'node'`, so a rule with
// React beside it cannot be pinned; this file has none.

/**
 * Every platform this console has a mark for.
 *
 * `platform-mark.tsx` types its artwork record against this list, so a key added
 * here without a glyph — or a glyph added there without a key — is a compile
 * error rather than a footer that silently prints "bluesky".
 */
export const PLATFORM_KEYS = [
  'facebook_page',
  'instagram',
  'threads',
  'linkedin',
  'x',
  'tiktok',
  'pinterest',
  'youtube',
  'google_business',
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

const KNOWN = new Set<string>(PLATFORM_KEYS);

/**
 * The names that mean one of the above without spelling it.
 *
 * Two kinds of entry, and both are somebody's real typing:
 *   · the site-chrome word for a connected-account key (`facebook`)
 *   · what a person shortens a network to (`ig`, `fb`, `twitter`)
 *
 * Every value here must be a `PlatformKey`, which the type enforces — an alias
 * pointing at a name with no artwork would resolve to "known" and then draw
 * nothing at all.
 */
const ALIAS: Record<string, PlatformKey> = {
  facebook: 'facebook_page',
  fb: 'facebook_page',
  twitter: 'x',
  ig: 'instagram',
  insta: 'instagram',
  yt: 'youtube',
  li: 'linkedin',
  google: 'google_business',
};

/**
 * Which mark a platform name draws, or null when there is none.
 *
 * A CANONICAL KEY IS CHECKED FIRST, and that order is the whole correctness of
 * this function rather than an optimization. Two of the keys carry an underscore
 * — `facebook_page`, `google_business` — and the normalization below strips
 * punctuation, so running it first turns them into `facebookpage` and
 * `googlebusiness`, which match nothing. Every connected account on the Social
 * screens is stored under one of those keys, so this file would have quietly
 * blanked the avatars on a screen it was not written for.
 *
 * AFTER that, case and punctuation are stripped: "Instagram", "instagram" and
 * "Instagram " are one network, not three, and the owner typed whichever of them
 * she typed. Same normalization the live site's own `SocialLinks` does, so the
 * canvas and the footer agree on what is drawable.
 */
export function platformGlyphKey(platform: string): PlatformKey | null {
  if (KNOWN.has(platform)) return platform as PlatformKey;
  const key = platform.toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolved = ALIAS[key] ?? key;
  return KNOWN.has(resolved) ? (resolved as PlatformKey) : null;
}
