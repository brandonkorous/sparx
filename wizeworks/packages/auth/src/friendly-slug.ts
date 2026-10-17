// Friendly tenant-slug generator (adjective-noun-number, e.g. "swift-harbor-3829").
//
// Every tenant is born with a generated slug rather than one derived from a
// name typed at sign-up: at sign-up the user doesn't yet know what they're
// building, so we hand them a unique, readable placeholder and let them
// personalize it in the onboarding Workspace step. A friendly slug (not a raw
// GUID) reads as an intentional placeholder — `swift-harbor-3829.sparx.zone`,
// never `a3f8…sparx.zone`. The combinatorial space (~11M) makes collisions rare;
// callers still confirm uniqueness against the DB before use.

const ADJECTIVES = [
  'swift',
  'bright',
  'calm',
  'bold',
  'brave',
  'clever',
  'cosmic',
  'crisp',
  'eager',
  'fair',
  'gentle',
  'glad',
  'golden',
  'happy',
  'keen',
  'lively',
  'lucky',
  'lunar',
  'merry',
  'mighty',
  'noble',
  'polar',
  'prime',
  'quick',
  'quiet',
  'rapid',
  'royal',
  'sleek',
  'solar',
  'spry',
  'stellar',
  'sunny',
  'tidy',
  'vivid',
  'warm',
  'wise',
] as const;

const NOUNS = [
  'harbor',
  'meadow',
  'summit',
  'river',
  'canyon',
  'cedar',
  'comet',
  'delta',
  'ember',
  'falcon',
  'forest',
  'garden',
  'glade',
  'grove',
  'haven',
  'horizon',
  'island',
  'lantern',
  'maple',
  'meridian',
  'orchard',
  'otter',
  'pine',
  'prairie',
  'quartz',
  'ridge',
  'sparrow',
  'spruce',
  'station',
  'studio',
  'thicket',
  'tide',
  'valley',
  'willow',
  'harvest',
  'beacon',
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * Whether a slug is still the placeholder this file made. Setup offers the
 * owner's own name in its place, and must never swap out one they chose
 * (sparx persona issue 295). Also matches the collision fallback's extra
 * `-xxxx` in provision-tenant.ts.
 */
export function isFriendlySlug(slug: string): boolean {
  const match = /^([a-z]+)-([a-z]+)-(\d{4})(?:-[a-z0-9]{1,4})?$/.exec(slug);
  if (!match) return false;
  return (
    (ADJECTIVES as readonly string[]).includes(match[1]!) &&
    (NOUNS as readonly string[]).includes(match[2]!)
  );
}

/** A single candidate slug. Not guaranteed unique — see generateUniqueTenantSlug. */
export function randomFriendlySlug(): string {
  const num = Math.floor(Math.random() * 9000) + 1000; // 1000–9999
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${num}`;
}
