// Attribution tie-in (docs/80 + docs/133) — tag a post's outbound link at publish time
// so a click that lands back on the tenant's own site is attributed to the social source
// it came from, and shows up in the same reports as every other channel.
//
// Deliberately reuses the ONE UTM builder + controlled taxonomy in @sparx/attribution
// rather than inventing an ad-hoc tag (which is exactly the fragmentation the taxonomy
// exists to prevent). It runs HERE, at publish, not in the shared renderer: the renderer
// is pure and also drives the composer preview, which should show the human link, not a
// tracking URL — and the campaign month is a publish-time fact.

import { buildUtmUrl } from '@sparx/attribution';
import type { SocialPlatform } from '@sparx/social';

// Each platform → a registered utm_source (attribution taxonomy). Facebook, Instagram
// and Threads share the taxonomy's Meta-family source `meta`; the specific surface rides
// in utm_content, so a report can still tell an Instagram click from a Facebook one.
const PLATFORM_SOURCE: Record<string, string> = {
  facebook_page: 'meta',
  instagram: 'meta',
  threads: 'meta',
  linkedin: 'linkedin',
  google_business: 'google',
  x: 'x',
  tiktok: 'tiktok',
  pinterest: 'pinterest',
  youtube: 'youtube',
};

// The utm_* an author may have already put on the link themselves — if any is present we
// leave their tagging untouched rather than overwrite it.
const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
];

/** `social-2026-07` — groups a month's organic posting; valid per the taxonomy's
 *  `{initiative}-{yyyy-mm}` campaign convention. */
function campaignFor(when: Date): string {
  return `social-${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Tag a post's outbound link for attribution: utm_source per platform, utm_medium
 * `organic-social`, utm_campaign `social-<yyyy-mm>`, utm_content the specific platform.
 *
 * Returns the link UNCHANGED when there is none, it isn't an http(s) URL (a `mailto:`,
 * a bare handle), or the author already UTM-tagged it — their tags win. Never throws:
 * a link we can't parse is published as-is.
 */
export function tagSocialLink(
  link: string | undefined,
  platform: SocialPlatform,
  when: Date
): string | undefined {
  if (!link) return link;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return link;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return link;
  if (UTM_PARAMS.some((p) => url.searchParams.has(p))) return link;

  const source = PLATFORM_SOURCE[platform] ?? 'partner-social';
  return buildUtmUrl(link, {
    source,
    medium: 'organic-social',
    campaign: campaignFor(when),
    content: platform,
  });
}
