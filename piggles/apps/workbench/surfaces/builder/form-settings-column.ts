// The two things both form-settings panes use. Its own file so neither imports
// the other just to share them.
export const SETTINGS_COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/**
 * Where a form sits, in words.
 *
 * A null slug is the home page — the same convention the submit route and the
 * funnels form picker both use, so the three cannot describe the same form
 * differently.
 */
export function formPageWords(pageSlug: string | null): string {
  if (!pageSlug) return 'On your home page';
  return `On /${pageSlug.replace(/^\//, '')}`;
}

/** Registry module for these panes, so their waiting and failed states wear the
 *  brand's own artwork for this app rather than the generic mark. */
export const MODULE = 'builder';
