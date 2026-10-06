// A trade account's fleet: the vehicles (or machines) a business runs, stored on
// the account so the shop can tell a buyer which parts fit them (sparx persona
// issue 086).
//
// This file is the db-free half: the shape every surface reads and the words a
// vehicle is called by. The staff console, the tenant website, the portal and the
// API all print a vehicle the same way, so a buyer who sees "Unit 12, 2019 Ram
// 3500 6.7L Cummins" on the product page sees the same words on their fleet page.
// The stored entry, its validation and the fit matching live in @wizeworks/b2b.

/** One fleet vehicle as every reader sees it. `id` is stable for the life of the
 *  vehicle: service bookings and history are linked to it, so an edit never
 *  changes it. */
export interface FleetVehicle {
  id: string;
  /** What the business calls it: a name or a unit number ("Unit 12"). */
  label: string;
  year: number | null;
  /** Typed by hand only when the vehicle is not in the shop's fitment list. When
   *  it is, the make and model come from `nodePath`. */
  make: string | null;
  model: string | null;
  vin: string | null;
  notes: string | null;
  mileage: number | null;
  /** How many identical vehicles this entry stands for. */
  count: number;
  /** The fitment list (and the entry in it) the vehicle was picked from. This is
   *  what parts are matched against; null means it was typed by hand. */
  domainId: string | null;
  nodeId: string | null;
  /** The picked entry and everything above it, top first:
   *  ["Ram", "3500", "6.7L Cummins"]. Empty when nothing was picked. */
  nodePath: string[];
}

type Describable = Pick<FleetVehicle, 'year' | 'make' | 'model' | 'nodePath'>;

function clean(s: string | null | undefined): string {
  return (s ?? '').trim();
}

/** The vehicle itself, without its name: "2019 Ram 3500 6.7L Cummins". Empty
 *  when nothing is known beyond the name. */
export function vehicleDescription(v: Describable): string {
  const picked = v.nodePath.map(clean).filter(Boolean);
  const words = picked.length > 0 ? picked : [clean(v.make), clean(v.model)].filter(Boolean);
  return [v.year ? String(v.year) : '', ...words].filter(Boolean).join(' ');
}

/** The vehicle as a person names it: "Unit 12, 2019 Ram 3500 6.7L Cummins". The
 *  name alone when nothing else is known, the description alone when it has no
 *  name, and never the same words twice. */
export function vehicleLabel(v: Describable & Pick<FleetVehicle, 'label'>): string {
  const name = clean(v.label);
  const description = vehicleDescription(v);
  if (!name) return description || 'Vehicle';
  if (!description || name.toLowerCase() === description.toLowerCase()) return name;
  return `${name}, ${description}`;
}

/** What a product's fit means for one signed-in trade buyer. Absent (null) when
 *  the buyer has no fleet, or when the product has no fitment data for the kind
 *  of vehicle the fleet holds: no data is not the same as "does not fit". */
export interface FleetFit {
  fits: boolean;
  /** The buyer's vehicles this product fits, already worded. */
  vehicles: { id: string; label: string }[];
}

/** The sentence a product page prints for a fit: "Fits Unit 12, 2019 Ram 3500
 *  6.7L Cummins and Unit 14, 2021 Ford F-350". */
export function fitsSentence(vehicles: { label: string }[]): string {
  const labels = vehicles.map((v) => v.label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return `Fits ${labels[0]}`;
  if (labels.length === 2) return `Fits ${labels[0]} and ${labels[1]}`;
  return `Fits ${labels.slice(0, -1).join('; ')}; and ${labels[labels.length - 1]}`;
}

/** The first choice in a fitment level box: "Choose a make", "Choose an
 *  engine". The level names are the shop's own, so the article is worked out
 *  from the word. It read "Choose a engine" (sparx persona issue 086). */
export function chooseLevelLabel(label: string): string {
  const word = label.toLowerCase();
  return `Choose ${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}
