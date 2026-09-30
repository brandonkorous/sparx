import type { TradePage } from './types';
import { TRADE_LINKS } from './list';

import { BAKERY } from './bakery';
import { BARBER } from './barber';
import { POTTER } from './potter';
import { GARAGE } from './garage';
import { MARKET_STALL } from './market-stall';
import { SALON } from './salon';
import { TAILOR } from './tailor';
import { STUDIO } from './studio';
import { WORKSHOP } from './workshop';
import { SUPPLIER } from './supplier';
import { SIDE_BUSINESS } from './side-business';

export type { TradePage, TradeMoment, TradeProblem, TradeQuestion } from './types';

/** Every /for/<trade> page, in the order of the light list the menus use. */
export const TRADES: readonly TradePage[] = [
  BAKERY,
  BARBER,
  POTTER,
  GARAGE,
  MARKET_STALL,
  SALON,
  TAILOR,
  STUDIO,
  WORKSHOP,
  SUPPLIER,
  SIDE_BUSINESS,
];

export const TRADE_BY_SLUG: Readonly<Record<string, TradePage>> = Object.fromEntries(
  TRADES.map((t) => [t.slug, t])
);

// The menus read the light list; if the two ever disagree, a menu links to a 404.
for (const link of TRADE_LINKS) {
  if (!TRADE_BY_SLUG[link.slug]) throw new Error(`No trade page for /for/${link.slug}`);
}
