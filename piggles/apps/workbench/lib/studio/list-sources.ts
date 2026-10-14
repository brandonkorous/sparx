// The lists of writing a list on a page can show — "What this list shows".
//
// Read off the binding catalog, which already names every kind of writing the
// business has (`cms.article` as "Articles") and the sections within one
// (`cmsWhere.article.section.field` as "Articles in Field"). Only for a list that
// shows writing: a product list has its own panel and its own choices.

import type { ListSourceChoice } from '@wizeworks/studio/react';
import type { BindingCatalog } from './site-data';

const isWriting = (ref: string): boolean => ref.startsWith('cms.') || ref.startsWith('cmsWhere.');

/** Every list of writing the business uses, `current` first when the catalog no longer
 *  names it, so a list never reads as showing something else. Empty for any other list. */
export function writingListChoices(
  catalog: BindingCatalog | undefined,
  current: string
): ListSourceChoice[] {
  if (!isWriting(current)) return [];
  // Only kinds the business made or has written in; the one shown now always stays.
  const choices = (catalog?.sources ?? [])
    .filter((s) => s.cardinality === 'array' && isWriting(s.key))
    .filter((s) => s.used !== false || s.key === current)
    .map((s) => ({ ref: s.key, label: s.label }));
  if (!choices.some((c) => c.ref === current)) choices.unshift({ ref: current, label: current });
  return choices;
}

/** The kinds of writing an email can list (`cms.<kind>`, never a section filter, which
 *  the send does not fill), only those the business made or has written in. Not its
 *  pages: "Latest Pages" would put the privacy policy in a newsletter. */
export function emailWritingKinds(
  catalog: BindingCatalog | undefined
): { ref: string; label: string }[] {
  return (catalog?.sources ?? [])
    .filter((s) => s.cardinality === 'array' && s.key.startsWith('cms.') && s.used !== false)
    .filter((s) => s.key !== 'cms.page')
    .map((s) => ({ ref: s.key, label: s.label }));
}
