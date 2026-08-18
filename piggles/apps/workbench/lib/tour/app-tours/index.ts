// One short walk per app — the tier-2 guides, and the lookup the runtime uses.
//
// ── WHY EACH ONE WALKS THE PANEL AND NOT THE BUTTONS ────────────────────────
//
// The obvious way to teach an app is to point at its controls: here is Add
// product, here is Send. It teaches the wrong thing here. Every Piggles app is
// already switched on and already full, so nobody is stuck for want of a button
// — they are stuck for want of knowing which of twenty screens is the one they
// want. So every step rings a ROW IN THE APP'S PANEL and says what that screen
// is for, in order of what you would actually do first.
//
// It is also the sturdier choice: a surface can be rebuilt without breaking a
// step, and one file carries every anchor these guides depend on
// (components/app-panel.tsx) rather than thirteen apps' worth of buttons.
//
// Split by the six colour groups the product already organises itself by, so
// finding the words for an app means opening the file its rail hue names.

import type { Guide, GuideKey } from '../types';
import { CONTENT_GUIDE, SITE_GUIDE } from './web';
import { GET_FOUND_GUIDE, PARTNERS_GUIDE, SELL_GUIDE, STOCK_GUIDE } from './sell';
import { BOOKINGS_GUIDE, CUSTOMERS_GUIDE, MESSAGES_GUIDE } from './people';
import { INVOICES_GUIDE, MONEY_GUIDE } from './money';
import { AUTOMATIONS_GUIDE, CONNECTIONS_GUIDE, TEAM_GUIDE } from './run';

const ALL: Guide[] = [
  SITE_GUIDE,
  CONTENT_GUIDE,
  GET_FOUND_GUIDE,
  SELL_GUIDE,
  STOCK_GUIDE,
  PARTNERS_GUIDE,
  CUSTOMERS_GUIDE,
  MESSAGES_GUIDE,
  BOOKINGS_GUIDE,
  INVOICES_GUIDE,
  MONEY_GUIDE,
  TEAM_GUIDE,
  AUTOMATIONS_GUIDE,
  CONNECTIONS_GUIDE,
];

const BY_KEY = new Map<GuideKey, Guide>(ALL.map((guide) => [guide.id as GuideKey, guide]));

/** The guide for a tier-2 key, or undefined where there is none. */
export function appGuide(key: GuideKey): Guide | undefined {
  return BY_KEY.get(key);
}

/** Every app guide — used by the panel's "Show me around" and by tests that
 *  check each step points at something that exists. */
export function allAppGuides(): Guide[] {
  return ALL;
}
