// Auth-side tenant-lifecycle event publisher. Mirrors email-events.ts —
// signUpMerchant emits a typed `tenant.created` event after the tenant row
// commits, which the legal-seed worker consumes to seed starter legal pages
// (docs/42 §3). Fire-and-forget: a Pub/Sub outage must never roll back an
// otherwise successful sign-up.

import {
  createPublisher,
  publishEvent,
  resolveTransport,
  type PublisherLogger,
  type TenantCreatedPayload,
} from '@wizeworks/events';
import { seedLegalPages } from '@wizeworks/legal-seed';

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
  // When the configured transport DISCARDS events, nothing will ever consume
  // the `tenant.created` published below — so seed the starter legal pages +
  // footer placements in-process instead, sharing the worker's exact idempotent
  // seeder (docs/104 §4.3). Swallowed: legal seeding must never fail an
  // otherwise-successful sign-up (same ethos as below).
  //
  // The predicate is the TRANSPORT, not a cloud's project id. This used to read
  // `if (!process.env.GCP_PROJECT_ID)`, which conflated "no Google project" with
  // "no worker will receive this" — a coincidence that held only while GCP was
  // the only way to deliver an event. On Azure it silently became false while
  // the worker was in fact unreachable, so neither path ran the seeder.
  //
  // `log` is the only transport that drops events on the floor. `http`
  // dev-dispatch DOES reach legal-seed-worker (it is in SPARX_DEV_WORKER_ROUTES)
  // and exercises the same HTTP entrypoint a real broker pushes to, so it
  // correctly takes the async path.
  //
  // The platform-CRM mirror (docs/140) deliberately gets no in-process twin:
  // importing it here would drag the whole CRM service layer into every app
  // that can sign a tenant up.
  if (resolveTransport().kind === 'log') {
    try {
      await seedLegalPages(input.tenantId, logger);
    } catch (err) {
      logger.error({ err, tenantId: input.tenantId }, 'in-process legal seed failed');
    }
  }

  const publisher = createPublisher({ logger });
  const payload: TenantCreatedPayload = { slug: input.slug, name: input.name };
  await publishEvent(publisher, 'tenant.created', input.tenantId, input.actorId, payload, logger);
}
