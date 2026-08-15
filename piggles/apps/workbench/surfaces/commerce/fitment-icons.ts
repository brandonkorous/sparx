// The icon a fitment domain shows.
//
// A domain stores an `iconKey` — a lucide icon NAME, the same one the starter
// library authors ("car", "smartphone", "paw-print"). The list, the detail
// header and the starter picker all need to turn that string into a real
// component, and the detail form lets an owner pick one.
//
// Kept as a fixed, curated set rather than a dynamic lookup over all of lucide:
// an owner choosing "which picture" wants a short, meaningful shortlist, not a
// thousand-icon search, and a fixed map is type-safe and tree-shakes cleanly.

import type { LucideIcon } from 'lucide-react';
import {
  AirVent,
  Bike,
  Car,
  Construction,
  Disc,
  Footprints,
  Glasses,
  Guitar,
  Package,
  PawPrint,
  Puzzle,
  Ship,
  Shirt,
  Smartphone,
  Sofa,
  WashingMachine,
  Wrench,
} from 'lucide-react';

export interface FitmentIconChoice {
  key: string;
  /** A plain-language label for the picker — what an owner would call it. */
  label: string;
  Icon: LucideIcon;
}

/** The pickable icons, in a sensible browse order. Keys match the starter
 *  library's `iconKey`s so an installed list keeps its intended picture. */
export const FITMENT_ICONS: FitmentIconChoice[] = [
  { key: 'car', label: 'Vehicle', Icon: Car },
  { key: 'smartphone', label: 'Phone or tablet', Icon: Smartphone },
  { key: 'shirt', label: 'Clothing', Icon: Shirt },
  { key: 'footprints', label: 'Footwear', Icon: Footprints },
  { key: 'paw-print', label: 'Pet', Icon: PawPrint },
  { key: 'construction', label: 'Machinery', Icon: Construction },
  { key: 'bike', label: 'Bicycle', Icon: Bike },
  { key: 'glasses', label: 'Eyewear', Icon: Glasses },
  { key: 'disc', label: 'Tires & wheels', Icon: Disc },
  { key: 'air-vent', label: 'Filters', Icon: AirVent },
  { key: 'sofa', label: 'Furniture', Icon: Sofa },
  { key: 'ship', label: 'Boat or powersport', Icon: Ship },
  { key: 'guitar', label: 'Instrument', Icon: Guitar },
  { key: 'washing-machine', label: 'Appliance', Icon: WashingMachine },
  { key: 'wrench', label: 'Parts', Icon: Wrench },
  { key: 'package', label: 'Something else', Icon: Package },
];

const ICON_BY_KEY = new Map(FITMENT_ICONS.map((choice) => [choice.key, choice.Icon]));

/** The component for a stored `iconKey`, falling back to a neutral puzzle piece
 *  for an unknown key or none — the same mark the module wears in the nav. */
export function resolveFitmentIcon(key: string | null | undefined): LucideIcon {
  if (key) {
    const found = ICON_BY_KEY.get(key);
    if (found) return found;
  }
  return Puzzle;
}
