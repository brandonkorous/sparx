// What the delete-a-page warning says. Pure, so the sentences can be held to what
// deleting actually does.

import type { PageSummary } from '../../lib/studio/page-data';
import { isSiteOwnRoute } from '@wizeworks/silica-catalog';

import { isTemplate, routeOf } from './page-address';

/**
 * What deleting this page costs, in the order it matters: what it takes with it,
 * who else claims its address, and whether anyone outside the business will notice.
 */
export function deletePageCost(page: PageSummary, peers: readonly string[]): string {
  const home = routeOf(page) === '/';
  const names = peers.join(' and ');
  const one = peers.length === 1;
  const lines: string[] = [];

  // A record page is never missing: the site draws the standard design without it, and
  // the page list makes a fresh copy of that design the next time it loads.
  if (isTemplate(page) && page.recordSubtype) {
    return [
      'Those products go back to the design every other product uses, straight away.',
      'There is no undo: this design is gone for good.',
    ].join(' ');
  }
  if (isTemplate(page)) {
    return [
      'Every one of those records goes back to the standard design straight away, and a fresh copy of that design appears in your page list.',
      'There is no undo: what you changed on this one is gone for good.',
    ].join(' ');
  }
  // The site answers its own routes (`/cart`, `/search`) whatever is in the page list.
  if (peers.length === 0 && isSiteOwnRoute(routeOf(page))) {
    return [
      `Your site keeps ${routeOf(page)}, because it needs it: it goes back to the standard design straight away, and a fresh copy appears in your page list.`,
      'There is no undo: what you changed on this one is gone for good.',
    ].join(' ');
  }
  if (peers.length > 0) {
    // The reason somebody is usually here: two pages claim one address and the
    // site check told them to pick. Naming the SURVIVOR is the whole answer.
    lines.push(
      home
        ? `${names} ${one ? 'is' : 'are'} also set to be your home page, and will have it to ${one ? 'itself' : 'themselves'}.`
        : `${names} also answer${one ? 's' : ''} to ${routeOf(page)}, and will have it to ${one ? 'itself' : 'themselves'}.`
    );
  } else {
    lines.push(
      home
        ? 'It is the only page set to be your home page, so your site will not have one until you clear another page’s address.'
        : `Nothing else answers to ${routeOf(page)}, so that address stops working.`
    );
  }

  // `live`, not `published`: a starter address is served with the standard design
  // before anyone publishes it (the list's "Live · standard design").
  lines.push(
    page.published || page.live
      ? 'It is live right now. Anyone who follows a link to it, or finds it in Google, will get a not-found page straight away.'
      : 'It has never been live, so nobody outside your business has seen it.'
  );
  lines.push('There is no undo: the page and everything on it go for good.');
  return lines.join(' ');
}
