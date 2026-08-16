import {
  faAddressCard,
  faBagShopping,
  faBoxesStacked,
  faCalendarClock,
  faDiagramProject,
  faFileInvoice,
  faGlobe,
  faHandshake,
  faHouse,
  faMagnifyingGlass,
  faMessage,
  faNewspaper,
  faPlug,
  faUsers,
  faWallet,
} from '@fortawesome/pro-solid-svg-icons';

/** Taken off a real icon so this file needs no `fontawesome-common-types` dep. */
type IconDefinition = typeof faHouse;

/**
 * The rail glyph for each Piggles app — chosen, not inherited. A Piggles app is
 * not a module ("Sell" fronts three), so taking the primary module's icon would
 * make the rail's most persistent glyph an accident of listing order.
 */
// Two decisions worth not re-litigating:
//   • Money is a WALLET, not a piggy bank — money is plain and calm (RULE #3).
//   • Customers is a crowd, My Team is one person on a card. Two people-shaped
//     apps must not collapse to the same silhouette at 16px.
export const APP_ICONS: Record<string, IconDefinition> = {
  home: faHouse,
  site: faGlobe,
  content: faNewspaper,
  get_found: faMagnifyingGlass,
  sell: faBagShopping,
  stock: faBoxesStacked,
  customers: faUsers,
  messages: faMessage,
  bookings: faCalendarClock,
  invoices: faFileInvoice,
  money: faWallet,
  team: faAddressCard,
  automations: faDiagramProject,
  partners: faHandshake,
  connections: faPlug,
};

/** Falls back rather than leaving a hole — visibly wrong beats absent, and it
 *  is obvious enough to get fixed. */
export function appIcon(appId: string): IconDefinition {
  return APP_ICONS[appId] ?? faHouse;
}
