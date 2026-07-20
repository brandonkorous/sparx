// INGEST (docs/81 §7) — the Cloud Run push handler's per-envelope work.
//
// Matching + condition evaluation happen here; EXECUTION is handed to the
// durable `automation_runs` table (not an in-memory queue), so a redeploy or
// scale-to-zero between ingest and execution is harmless. The loop:
//
//   1. find active automations whose trigger_type == the event type
//   2. loop-guard: refuse to spawn past the automation's max_depth
//   3. hydrate the referenced entity → evaluate conditions over RESOLVED fields
//   4. idempotent upsert of a run row — (automation_id, dedupe_key) UNIQUE
//      collapses an at-least-once redelivery onto the same run
//
// We resolve the entity ONCE per envelope (the resolver is keyed by event type,
// so every matching automation sees the same fields). The run row stores the
// envelope, not the fields — the tick re-resolves at execution time so effects
// act on fresh state.

import { ConditionGroup } from '@sparx/automation-schemas';
import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { evaluateConditions } from '../conditions/evaluate';
import type { EngineDeps, TenantCtx, TriggerEnvelope } from '../engine-types';
import { propertyOf, resolveFields } from '../resolvers/registry';
import { dedupeOf } from './idempotency';
import { installBuiltins } from './install';

export async function handleTrigger(
  envelope: TriggerEnvelope,
  deps: EngineDeps,
  client?: PrismaClient
): Promise<void> {
  installBuiltins();

  const { type, tenantId } = envelope;
  const payload = (envelope.data ?? {}) as Record<string, unknown>;
  const rawDepth = payload.__automationDepth;
  const depth = typeof rawDepth === 'number' ? rawDepth : 0;
  const dedupeKey = dedupeOf(envelope);

  await withTenant(
    { tenantId },
    async (tx) => {
      const automations = await tx.automation.findMany({
        where: { status: 'active', triggerType: type },
      });
      if (automations.length === 0) return;

      const ctx: TenantCtx = { tenantId, tx, deps, causeDepth: depth };
      const fields = await resolveFields(ctx, type, payload);

      // WHICH BUSINESS this event happened on (docs/131 §3.1). Read from the
      // RESOLVED ENTITY rather than the envelope: `SparxEvent` has no propertyId
      // and adding one would mean touching every publisher on the platform,
      // while the entity already knows — and knows authoritatively, since the
      // row is the record of what happened.
      const eventProperty = propertyOf(fields);

      for (const a of automations) {
        // The site filter. A tenant-wide rule (propertyId null) runs on
        // everything; a site-scoped rule runs only on its own site's events.
        //
        // An UNKNOWN site (null eventProperty — no resolver for this event type,
        // or an entity with no site) runs only tenant-wide rules. That is the
        // deliberate direction to fail: a site-scoped rule that silently does
        // not fire is a rule someone can notice and fix, whereas one that fires
        // on another business's records sends that business's customers the
        // wrong email, which cannot be taken back. Logged, not swallowed.
        if (a.propertyId !== null && a.propertyId !== eventProperty) {
          deps.logger.debug(
            { automationId: a.id, automationProperty: a.propertyId, eventProperty },
            eventProperty === null
              ? 'automation: skipped (event site unknown, rule is site-scoped)'
              : 'automation: skipped (different site)'
          );
          continue;
        }

        if (depth >= a.maxDepth) {
          deps.logger.debug(
            { automationId: a.id, depth, maxDepth: a.maxDepth },
            'automation: skipped (max_depth_exceeded)'
          );
          continue;
        }

        const parsed = ConditionGroup.safeParse(a.conditions);
        if (!parsed.success) {
          deps.logger.warn(
            { automationId: a.id },
            'automation: invalid stored conditions — skipping'
          );
          continue;
        }
        if (!evaluateConditions(parsed.data, fields)) {
          deps.logger.debug({ automationId: a.id }, 'automation: skipped (condition_not_met)');
          continue;
        }

        const actionsTotal = Array.isArray(a.actions) ? a.actions.length : 0;
        await tx.automationRun.upsert({
          where: { automationId_dedupeKey: { automationId: a.id, dedupeKey } },
          create: {
            automationId: a.id,
            tenantId,
            // Stamped from the EVENT, not the automation: a tenant-wide rule
            // that fires on a donut order produced a donut-site run, and "what
            // ran on this site" has to answer with where it acted, not how it
            // was scoped.
            propertyId: eventProperty,
            triggerEvent: envelope as unknown as Prisma.InputJsonValue,
            dedupeKey,
            causeDepth: depth,
            status: 'running',
            cursorIndex: 0,
            actionsTotal,
            automationVersion: a.version,
          },
          update: {}, // already enqueued — at-least-once redelivery is a no-op
        });
      }
    },
    client
  );
}
