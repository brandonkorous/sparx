// What a kind's "Web address pattern" will do, said while she types it.
//
// The box says "Where these appear on your site", and since 2026-10-08 that is true for
// any pattern the site can serve: `/<words>/{slug}`, whose first word is not one of the
// site's own. The console asks the site's own rule (`kindAddressFromPattern`), so the
// note under the box and the page a visitor gets cannot disagree. The server refuses
// the rest on save with its own reason (`urlPatternProblem` in @wizeworks/cms).

import { kindAddressFromPattern } from '@wizeworks/silica-catalog';

/** "Article" → "article"; an acronym stays as it is. */
function lower(name: string): string {
  return /^[A-Z0-9]{2,}$/.test(name) ? name : name.toLowerCase();
}

/** The note under the pattern box, or null when the box is empty. `ok` false is a
 *  pattern the site cannot serve, and stops the save with this text. */
export function patternNote(pattern: string, name: string): { ok: boolean; text: string } | null {
  const value = pattern.trim();
  if (value === '') return null;
  const noun = name.trim() === '' ? 'one' : lower(name.trim());
  const address = kindAddressFromPattern(value);
  if (address) {
    return {
      ok: true,
      text: `Each ${noun} gets its own page at ${address.prefix}…, ending in the web address you give it. How they look is the "Each ${noun}" page in your site's pages.`,
    };
  }
  return {
    ok: false,
    text: 'Your site cannot show pages at this address. Write it like /recipes/{slug}: one or more lowercase words, then {slug}. Words your site already uses, such as /products and /blog, are taken.',
  };
}
