// Resource input schemas — staff, assets, tables, spaces, equipment.
//
// A resource is anything whose time a booking consumes. Availability is computed
// per resource and a booking allocates one or more (docs/79 §7.1). `exclusive`
// resources get the DB-level no-overlap guarantee; pooled ones use capacity
// counting instead (§7.4).

import { z } from 'zod';

import { HexColor, OptionalUuid, ResourceKind, Timezone, Uuid } from './common';

export const CreateResourceInput = z.object({
  kind: ResourceKind,
  // Staff resources link to a team-member User row (plain ref, no FK — §schema).
  userId: OptionalUuid,
  locationId: OptionalUuid,
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  color: HexColor.nullable().optional(),
  timezone: Timezone.default('UTC'),
  // false = pooled / intentionally overbookable (skips the hard EXCLUDE; §7.4).
  exclusive: z.boolean().default(true),
  // Pooled units, or seats. For tables, capacityMin/Max bound party size.
  capacity: z.number().int().min(1).max(100000).default(1),
  capacityMin: z.number().int().min(1).max(100000).nullable().optional(),
  capacityMax: z.number().int().min(1).max(100000).nullable().optional(),
  // Skill-based routing — a service requirement matches resources by these tags.
  skillTags: z.array(z.string().min(1).max(63)).max(50).default([]),
  bookableOnline: z.boolean().default(true),
  isActive: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).optional(),
  // Model B per-site scoping (docs/49 §3, docs/131 §4): the web PROPERTIES this
  // resource works for. EMPTY = works EVERY site (the default — an owner who covers
  // both businesses). Update sends the full replacement set.
  //
  // This is the write half of a junction that was read-only for its whole life: the
  // booking allocator, the resource list and the utilisation report all filtered on
  // `siteLinks`, and nothing ever created a row — so every resource was unrestricted
  // and a booking taken on one site could allocate the other business's staff, which
  // is the exact failure the junction exists to prevent.
  propertyIds: z.array(Uuid).max(50).default([]),
});
export type CreateResourceInput = z.infer<typeof CreateResourceInput>;

// `.partial()` makes every field optional but does NOT strip the `.default()`s, so an
// update that OMITS a defaulted field comes back with the create default re-applied —
// and `updateResource` would then WIPE the site links on a plain rename. Override the
// defaulted fields as plain-optional so "omitted = untouched" holds (the same guard
// UpdateCategoryInput carries, for the same reason).
export const UpdateResourceInput = CreateResourceInput.partial().extend({
  id: Uuid,
  timezone: Timezone.optional(),
  exclusive: z.boolean().optional(),
  capacity: z.number().int().min(1).max(100000).optional(),
  skillTags: z.array(z.string().min(1).max(63)).max(50).optional(),
  bookableOnline: z.boolean().optional(),
  isActive: z.boolean().optional(),
  propertyIds: z.array(Uuid).max(50).optional(),
});
export type UpdateResourceInput = z.infer<typeof UpdateResourceInput>;
