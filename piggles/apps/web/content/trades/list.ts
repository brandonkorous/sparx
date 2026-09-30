import type { PigglesGroup } from '@piggles/brand';
import type { MascotPoseId } from '@piggles/mascot';

// The trades, light: just enough for the header menu and the footer.
// The full pages live beside this file and are too heavy to ship to the browser.

export interface TradeLink {
  slug: string;
  pose: MascotPoseId;
  group: PigglesGroup;
  plural: string;
}

export const TRADE_LINKS: readonly TradeLink[] = [
  { slug: 'bakery', pose: 'bakery', group: 'sell', plural: 'Bakeries' },
  { slug: 'barber', pose: 'barber', group: 'people', plural: 'Barbers' },
  { slug: 'potter', pose: 'potter', group: 'run', plural: 'Potters' },
  { slug: 'garage', pose: 'garage', group: 'web', plural: 'Garages' },
  { slug: 'market-stall', pose: 'market-stall', group: 'money', plural: 'Market stalls' },
  { slug: 'salon', pose: 'salon', group: 'run', plural: 'Salons' },
  { slug: 'tailor', pose: 'tailor', group: 'sell', plural: 'Tailors' },
  { slug: 'studio', pose: 'art-studio', group: 'people', plural: 'Studios' },
  { slug: 'workshop', pose: 'workshop', group: 'web', plural: 'Workshops' },
  { slug: 'supplier', pose: 'supplier', group: 'money', plural: 'Suppliers' },
  { slug: 'side-business', pose: 'shed', group: 'run', plural: 'Side businesses' },
];
