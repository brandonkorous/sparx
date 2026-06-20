// Auth-side tenant-lifecycle event publisher. Mirrors email-events.ts —
// signUpMerchant emits a typed `tenant.created` event after the tenant row
// commits, which the legal-seed worker consumes to seed starter legal pages
// (docs/42 §3). Fire-and-forget: a Pub/Sub outage must never roll back an
// otherwise successful sign-up.

import {
  createPublisher,
  publishEvent,
  type PublisherLogger,
  type TenantCreatedPayload,
} from '@sparx/events';
import { seedLegalPages } from '@sparx/legal-seed';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

export interface PublishTenantCreatedInput {
  tenantId: string;
  actorId: string | null;
  slug: string;
  name: string;
}

export async function publishTenantCreated(input: PublishTenantCreatedInput): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID;

  // Dev (no `GCP_PROJECT_ID`) doesn't run the standalone legal-seed-worker, so the
  // `tenant.created` publish below no-ops — seed the starter legal pages + footer
  // placements in-process instead, sharing the worker's exact idempotent seeder
  // (docs/104 §4.3). Prod keeps the async worker path untouched. Swallowed: legal
  // seeding must never fail an otherwise-successful sign-up (same ethos as below).
  if (!projectId) {
    try {
      await seedLegalPages(input.tenantId, logger);
    } catch (err) {
      logger.error({ err, tenantId: input.tenantId }, 'in-process legal seed failed');
    }
  }

  const publisher = createPublisher({ projectId, logger });
  const payload: TenantCreatedPayload = { slug: input.slug, name: input.name };
  await publishEvent(publisher, 'tenant.created', input.tenantId, input.actorId, payload, logger);
}
