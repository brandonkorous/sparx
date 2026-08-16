// The icon a fitment domain shows.
//
// A domain stores an `iconKey` — an icon NAME, the same one the starter
// library authors ("car", "smartphone", "paw-print"). The list, the detail
// header and the starter picker all need to turn that string into a real
// component, and the detail form lets an owner pick one.
//
// Kept as a fixed, curated set rather than a dynamic lookup over the whole icon set:
// an owner choosing "which picture" wants a short, meaningful shortlist, not a
// thousand-icon search, and a fixed map is type-safe and tree-shakes cleanly.

import {
  faAirConditioner,
  faBicycle,
  faBox,
  faCar,
  faCompactDisc,
  faCouch,
  faGlasses,
  faGuitar,
  faHelmetSafety,
  faMobile,
  faPaw,
  faPuzzlePiece,
  faShip,
  faShirt,
  faShoePrints,
  faWashingMachine,
  faWrench,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';

export interface FitmentIconChoice {
  key: string;
  /** A plain-language label for the picker — what an owner would call it. */
  label: string;
  Icon: PigglesIcon;
}

/** The pickable icons, in a sensible browse order. Keys match the starter
 *  library's `iconKey`s so an installed list keeps its intended picture. */
export const FITMENT_ICONS: FitmentIconChoice[] = [
  { key: 'car', label: 'Vehicle', Icon: faCar },
  { key: 'smartphone', label: 'Phone or tablet', Icon: faMobile },
  { key: 'shirt', label: 'Clothing', Icon: faShirt },
  { key: 'footprints', label: 'Footwear', Icon: faShoePrints },
  { key: 'paw-print', label: 'Pet', Icon: faPaw },
  { key: 'construction', label: 'Machinery', Icon: faHelmetSafety },
  { key: 'bike', label: 'Bicycle', Icon: faBicycle },
  { key: 'glasses', label: 'Eyewear', Icon: faGlasses },
  { key: 'disc', label: 'Tires & wheels', Icon: faCompactDisc },
  { key: 'air-vent', label: 'Filters', Icon: faAirConditioner },
  { key: 'sofa', label: 'Furniture', Icon: faCouch },
  { key: 'ship', label: 'Boat or powersport', Icon: faShip },
  { key: 'guitar', label: 'Instrument', Icon: faGuitar },
  { key: 'washing-machine', label: 'Appliance', Icon: faWashingMachine },
  { key: 'wrench', label: 'Parts', Icon: faWrench },
  { key: 'package', label: 'Something else', Icon: faBox },
];

const ICON_BY_KEY = new Map(FITMENT_ICONS.map((choice) => [choice.key, choice.Icon]));

/** The component for a stored `iconKey`, falling back to a neutral puzzle piece
 *  for an unknown key or none — the same mark the module wears in the nav. */
export function resolveFitmentIcon(key: string | null | undefined): PigglesIcon {
  if (key) {
    const found = ICON_BY_KEY.get(key);
    if (found) return found;
  }
  return faPuzzlePiece;
}
