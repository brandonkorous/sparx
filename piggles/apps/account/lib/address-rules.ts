// The rules a web address obeys — pure string work, no database.
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
//
// The onboarding field derives the suggestion AS SHE TYPES her business name,
// which is the browser's job, and then claims it on the server. One rule, two
// runtimes: a second copy in the client would drift, and the visible symptom of
// that drift is a web address that is not the one the field promised.
//
// ── AN ADDRESS IS AN IDENTIFIER, SO IT IS ASKED FOR ONCE ────────────────────
//
// Identifiers do not change: the site is published on it, it stays the fallback
// after a custom domain is connected, and it is the Better Auth organization
// slug. So there is no rename later, and the whole answer to issue #010 is to
// OFFER it at the only two moments it is free — onboarding, and adding a site
// (Brandon, 2026-08-24). The derivation below is therefore a SUGGESTION filling
// a field she is looking at, never a decision taken on her behalf.

/** Words dropped from the front of a suggestion — a business called "The Reading
 *  Room" wants `reading-room`, and a leading article makes every alphabetical
 *  list wrong. Only stripped when something survives, and only from a SUGGESTION:
 *  an address somebody typed is theirs, articles included. */
const LEADING_NOISE = /^(the|a|an)-/;

/** A DNS label caps at 63 characters, and `tenants.slug` is varchar(63). */
export const ADDRESS_MAX = 63;

/**
 * Labels Piggles operates itself, so nobody's shop can claim one.
 *
 * `customers` is the load-bearing entry — it is the CNAME target every customer
 * connecting their own domain is told to point at, so a business holding it
 * would break every custom domain on the platform.
 */
export const RESERVED_ADDRESSES = new Set([
  'admin',
  'api',
  'app',
  'customers',
  'get',
  'help',
  'mail',
  'meet',
  'my',
  'piggles',
  'status',
  'support',
  'www',
]);

export type AddressVerdict = 'free' | 'taken' | 'reserved' | 'unusable' | 'yours';

/** Fold accents onto their base letters so "Tomás" survives as `tomas` rather
 *  than losing a character to a separator. */
function fold(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * An address exactly as somebody typed it, tidied into a DNS label.
 *
 * No article stripping and no `&` expansion: this is not a business name being
 * interpreted, it is an address being cleaned up. Returns null when nothing
 * usable is left.
 */
export function slugifyAddress(typed: string): string | null {
  const slug = fold(typed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ADDRESS_MAX)
    .replace(/-+$/, '');

  return slug.length >= 2 ? slug : null;
}

/**
 * The address to SUGGEST for a business name.
 *
 * `&` becomes `and` rather than vanishing — "Thistle & Rye" is said "Thistle and
 * Rye", so `thistle-and-rye` is what somebody would type, and `thistle-rye` is a
 * word nobody uses.
 */
export function slugifyBusinessName(name: string): string | null {
  const slug = fold(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(LEADING_NOISE, '')
    // Trimmed to a whole word so the address does not end mid-syllable.
    .slice(0, ADDRESS_MAX)
    .replace(/-+$/, '');

  return slug.length >= 2 ? slug : null;
}

/**
 * The same rule, applied while somebody is still typing.
 *
 * `slugifyAddress` strips a trailing hyphen, which is right for a finished
 * string and wrong for one arriving a character at a time: **a hyphen is always
 * trailing at the moment it is typed**, so pressing `-` deleted it before the
 * next letter landed and `plant-care` came out `plantcare` — on an address that
 * can never be changed afterwards. Issue #181.
 *
 * Returns a string rather than null: this is what the field shows, and a field
 * that empties itself as somebody types into it is worse than a short one.
 */
export function slugifyAddressTyping(typed: string): string {
  // A run of separators collapses to ONE hyphen, so at most one can be trailing
  // and there is nothing left to trim. A leading one still goes: it is illegal
  // in a DNS label wherever the caret happens to be.
  return fold(typed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, ADDRESS_MAX);
}
