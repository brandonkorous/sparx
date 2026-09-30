'use client';

// Languages: naming one, checking one, and offering the ones a shop sells in.
//
// ── Why this is in lib/ and not beside a surface ────────────────────────────
//
// Adding a language used to mean typing a code. The field was labelled
// "Language code" and the help said "es, pt-BR, zh-Hans" — three strings a
// jewelry maker has no way to know and no way to guess. That was fixed for the
// Content translations pane (issue 402) by putting a NAMED list beside it, in
// `surfaces/cms/`, where no other pane could reach it.
//
// So the product's own "Other languages" pane kept the code box. Devi typed
// "French" into it and was told "That is not a language code" — on a screen that
// names every language she has already added, in words, one card above (issue
// 793). Three of the four panes that ask for a language were still text boxes.
//
// One list, in one place both modules can see, is the only shape that does not
// drift apart again. [[feedback_a_fix_leaves_its_neighbour_behind]]

/**
 * Canonicalize a language tag the way the server does — language lowercase,
 * script Titlecase, region UPPERCASE.
 *
 * Done here as well so an editor can key a DRAFT row on the same string the
 * server will store. Without it, typing `en-us` creates a draft under `en-us`
 * that comes back from the save as `en-US`, and the language appears twice with
 * the operator's edit apparently lost.
 */
export function canonicalLocale(raw: string): string {
  const parts = raw.trim().replace(/_/g, '-').split('-').filter(Boolean);
  return parts
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      // Four letters is a SCRIPT (Hans, Cyrl) — Titlecase; two or three in a
      // later position is a REGION — uppercase.
      if (part.length === 4) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      if (part.length === 2 || part.length === 3) return part.toUpperCase();
      return part.toLowerCase();
    })
    .join('-');
}

/** A language tag in the reader's own language ("Spanish (Mexico)"), falling
 *  back to the tag itself when the browser has no name for it. */
export function localeName(locale: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

/** Would the server accept this tag? Mirrors the BCP-47 shape the Locale schema
 *  enforces, so an editor can refuse it before spending a round trip. */
export function isValidLocale(raw: string): boolean {
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/.test(canonicalLocale(raw));
}

/**
 * The languages a shop picks from by name.
 *
 * Naming is `Intl.DisplayNames`, so the names arrive in the reader's own
 * language and nobody hand-maintains forty translations of "Portuguese".
 *
 * NOT AN EXHAUSTIVE LIST, and that is why the code box stays. This covers the
 * languages a small shop actually sells in; anything else is still reachable by
 * typing its code, so the list is a shortcut rather than a ceiling (RULE #1 —
 * simplification never removes capability).
 *
 * The regional pairs are here because they genuinely differ in shop copy:
 * Brazilian and European Portuguese, Latin American and European Spanish, the
 * two Chinese scripts.
 */
const COMMON = [
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en-GB',
  'es',
  'es-MX',
  'fi',
  'fr',
  'fr-CA',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-Hans',
  'zh-Hant',
] as const;

/** The value the "type a code instead" option carries. Not a language tag, and
 *  deliberately not one anybody could type: it never reaches the server. */
export const OTHER_LANGUAGE = '__other__';

/**
 * Value → label for the picker, minus the ones already used here.
 *
 * Sorted by the NAME rather than the code, because that is the order someone
 * reading the list is scanning in.
 */
export function languageOptions(taken: readonly string[]): Record<string, string> {
  const entries = COMMON.filter((tag) => !taken.includes(tag))
    .map((tag) => [tag, localeName(tag)] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  return {
    ...Object.fromEntries(entries),
    [OTHER_LANGUAGE]: 'Another language…',
  };
}
