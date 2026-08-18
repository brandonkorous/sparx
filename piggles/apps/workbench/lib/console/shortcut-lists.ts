// The two lists that are the PERSON's rather than the product's.
//
// They browse into the app panel the same way an app does, so they need ids the
// panel can be asked for. Prefixed, because an app id is a registry key and
// these are not apps — `~` cannot appear in one, so the two can never collide.

export const FAVOURITES_LIST = '~favourites';
export const RECENT_LIST = '~recent';

export type ShortcutList = typeof FAVOURITES_LIST | typeof RECENT_LIST;

export function isShortcutList(id: string | null | undefined): id is ShortcutList {
  return id === FAVOURITES_LIST || id === RECENT_LIST;
}
