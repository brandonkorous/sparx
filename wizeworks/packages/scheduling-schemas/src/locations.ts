// Business locations — the physical places a business serves customers from
// (docs/79 §21, docs/131 §4).
//
// A location is a PLACE, and a place is tenant-owned rather than site-owned: one
// premises can legitimately host more than one business (a shared storefront, one
// owner's building). That is why the site scope is a JUNCTION and not a column —
// `propertyIds` here, `scheduling_location_properties` in the database. EMPTY means
// every site, matching every other Model B entity.
//
// The address is JSONB rather than columns because address shape is not universal
// and this is displayed, not queried — nothing routes or taxes on it. Each part is
// bounded so the JSON cannot grow without limit.

import { z } from 'zod';

import { Timezone, Uuid } from './common';

/** A postal address, in the parts a person recognises. Every part optional: a
 *  market stall, a mobile groomer and a clinic all need to be describable, and a
 *  half-filled address is more useful than a required field nobody can answer. */
export const LocationAddress = z.object({
  line1: z.string().max(255).optional(),
  line2: z.string().max(255).optional(),
  city: z.string().max(127).optional(),
  region: z.string().max(127).optional(),
  postalCode: z.string().max(31).optional(),
  country: z.string().max(63).optional(),
});
export type LocationAddress = z.infer<typeof LocationAddress>;

export const CreateLocationInput = z.object({
  name: z.string().min(1).max(255),
  address: LocationAddress.default({}),
  // The zone the PLACE is in. Availability is resolved per resource in its own
  // zone (docs/79 §7.7); this is the fallback and what a customer is shown.
  //
  // NULL = follow the business's zone. Defaulting this to 'UTC' meant a place
  // nobody had opened still asserted where it was, and issue 108 made that
  // assertion set the hour of every appointment (issue 178).
  timezone: Timezone.nullable().optional(),
  // Optional map pin. Both or neither — a lone latitude locates nothing, so the
  // refinement below rejects half a coordinate rather than storing a useless one.
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().default(true),
  // Model B per-site scoping (docs/131 §4). EMPTY = every site.
  propertyIds: z.array(Uuid).max(50).default([]),
});
export type CreateLocationInput = z.infer<typeof CreateLocationInput>;

/** Both halves of a coordinate, or neither. */
const coordinatePaired = (input: { lat?: number | null; lng?: number | null }): boolean =>
  (input.lat == null) === (input.lng == null);
const COORDINATE_MESSAGE = 'Give both a latitude and a longitude, or neither.';

export const CreateLocation = CreateLocationInput.refine(coordinatePaired, {
  message: COORDINATE_MESSAGE,
  path: ['lng'],
});

// `.partial()` keeps the `.default()`s, and the service writes every key that is
// not undefined — so without these overrides a plain rename would reset the zone
// to UTC, re-activate a location the owner had switched off, blank the address and
// WIPE the site scope. Same footgun as UpdateResourceInput / UpdateCategoryInput;
// keep in sync with every `.default()` above.
export const UpdateLocationInput = CreateLocationInput.partial()
  .extend({
    id: Uuid,
    address: LocationAddress.optional(),
    timezone: Timezone.nullable().optional(),
    isActive: z.boolean().optional(),
    propertyIds: z.array(Uuid).max(50).optional(),
  })
  .refine(coordinatePaired, { message: COORDINATE_MESSAGE, path: ['lng'] });
export type UpdateLocationInput = z.infer<typeof UpdateLocationInput>;
