// Per-message handler. Pure function so tests can drive it without a Pub/Sub
// subscription. Validates the envelope, routes on event type, and mirrors the
// tenant into the platform CRM.
//
// Failure model:
//   - Envelope isn't one we handle → parseEvent returns null; index acks (no
//     retry) because a redelivery would be rejected identically.
//   - The mirror throws (transient DB error) → handle rethrows; index returns
//     500 and Pub/Sub redelivers. Every mirror path is idempotent, so retries
//     are safe and a redelivered signup does not duplicate the deal.
//
// Note the router accepts SEVERAL topics on one Cloud Run service: signup and
// the events that move the deal afterwards are the same concern, and splitting
// them across services would mean two deploys to change one board.

import type { Logger } from 'pino';
import { z } from 'zod';
import {
  mirrorTenant,
  recordModuleChange,
  recordSubscriptionChange,
  type MirrorOutcome,
} from '@wizeworks/platform-crm';

const HANDLED = [
  'tenant.created',
  'tenant.updated',
  'tenant.subscription.changed',
  'module.activated',
  'module.deactivated',
] as const;

type HandledType = (typeof HANDLED)[number];

const Envelope = z.object({
  type: z.enum(HANDLED),
  tenantId: z.string().min(1),
  actorId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  // Payload shapes differ per type; each branch validates what it reads rather
  // than forcing one union schema on five unrelated events.
  data: z.record(z.string(), z.unknown()).default({}),
});

export type WorkerEvent = z.infer<typeof Envelope>;

export function parseEvent(raw: unknown): WorkerEvent | null {
  const result = Envelope.safeParse(raw);
  return result.success ? result.data : null;
}

const SubscriptionData = z.object({
  status: z.string().min(1),
  mrrCents: z.number().nullish(),
  currency: z.string().nullish(),
});

const ModuleData = z.object({
  module: z.string().min(1),
});

export interface HandleOutcome {
  type: HandledType;
  outcome: MirrorOutcome;
}

export async function handle(event: WorkerEvent, logger: Logger): Promise<HandleOutcome> {
  const log = logger.child({ tenantId: event.tenantId, type: event.type });

  switch (event.type) {
    // Both take the same path: ensure the contact + deal exist and reflect the
    // tenant's current name. Creation and rename are one operation.
    case 'tenant.created':
    case 'tenant.updated':
      return { type: event.type, outcome: await mirrorTenant(event.tenantId, log) };

    case 'tenant.subscription.changed': {
      const data = SubscriptionData.parse(event.data);
      return {
        type: event.type,
        outcome: await recordSubscriptionChange(
          event.tenantId,
          {
            status: data.status,
            mrrCents: data.mrrCents ?? null,
            currency: data.currency ?? null,
          },
          log
        ),
      };
    }

    case 'module.activated':
    case 'module.deactivated': {
      const data = ModuleData.parse(event.data);
      return {
        type: event.type,
        outcome: await recordModuleChange(
          event.tenantId,
          {
            module: data.module,
            action: event.type === 'module.activated' ? 'activated' : 'deactivated',
          },
          log
        ),
      };
    }
  }
}
