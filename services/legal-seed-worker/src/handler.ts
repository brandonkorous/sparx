// Per-message handler. Pure function so tests can drive it without a Pub/Sub
// subscription. Validates the tenant.created envelope and seeds legal pages.
//
// Failure model:
//   - Envelope doesn't match tenant.created → parseEvent returns null; index
//     acks (no retry) since a redelivery would fail identically.
//   - Seed throws (transient DB error) → handle rethrows; index returns 500
//     and Pub/Sub redelivers. Seeding is idempotent, so retries are safe.

import type { Logger } from 'pino';
import { z } from 'zod';
import { seedLegalPages, type SeedResult } from '@sparx/legal-seed';

const TenantCreatedEvent = z.object({
  type: z.literal('tenant.created'),
  tenantId: z.string().min(1),
  actorId: z.string().nullable(),
  occurredAt: z.string(),
  data: z.object({
    slug: z.string(),
    name: z.string(),
  }),
});

export type TenantCreatedEvent = z.infer<typeof TenantCreatedEvent>;

export function parseEvent(raw: unknown): TenantCreatedEvent | null {
  const result = TenantCreatedEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface HandleOutcome extends SeedResult {
  status: 'seeded';
}

export async function handle(event: TenantCreatedEvent, logger: Logger): Promise<HandleOutcome> {
  const result = await seedLegalPages(event.tenantId, logger.child({ tenantId: event.tenantId }));
  return { status: 'seeded', ...result };
}
