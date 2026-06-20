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
});
export type CreateResourceInput = z.infer<typeof CreateResourceInput>;

export const UpdateResourceInput = CreateResourceInput.partial().extend({
  id: Uuid,
});
export type UpdateResourceInput = z.infer<typeof UpdateResourceInput>;
