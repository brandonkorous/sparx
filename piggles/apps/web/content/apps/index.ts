import type { PigglesAppId } from '@piggles/config';
import type { AppMarketing } from './types';

import { HOME } from './home';
import { SITE } from './site';
import { CONTENT } from './content';
import { GET_FOUND } from './get-found';
import { SELL } from './sell';
import { STOCK } from './stock';
import { PARTNERS } from './partners';
import { CUSTOMERS } from './customers';
import { MESSAGES } from './messages';
import { BOOKINGS } from './bookings';
import { INVOICES } from './invoices';
import { MONEY } from './money';
import { TEAM } from './team';
import { AUTOMATIONS } from './automations';
import { CONNECTIONS } from './connections';

export type { AppMarketing, AppChapter, AppClaim } from './types';

/**
 * Marketing copy for the fifteen app pages, one file each.
 *
 * Was a single 561-line module. It is a directory because the copy grew — the
 * pages carry chapters now, so the largest apps read as something proportionate
 * to what they front rather than six bullets each (see `AppChapter` in
 * ./types.ts) — and because piggles/CLAUDE.md RULE #0.5 caps a file at 250 lines.
 *
 * Keyed by `PigglesAppId`, so adding an app to the registry without writing its
 * page is a type error rather than a blank screen.
 */
export const APP_MARKETING: Record<PigglesAppId, AppMarketing> = {
  home: HOME,
  site: SITE,
  content: CONTENT,
  get_found: GET_FOUND,
  sell: SELL,
  stock: STOCK,
  partners: PARTNERS,
  customers: CUSTOMERS,
  messages: MESSAGES,
  bookings: BOOKINGS,
  invoices: INVOICES,
  money: MONEY,
  team: TEAM,
  automations: AUTOMATIONS,
  connections: CONNECTIONS,
};
