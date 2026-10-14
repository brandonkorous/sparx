// Search signals for the Bookings tools an AI client calls (persona issue 261).
//
// The REST routes tell search when a service, a person or piece of equipment, a
// place or a set of booking rules is made, changed or removed
// (`api-rest/src/lib/scheduling-search.ts`). The same writes made through these
// tools told it nothing, so a service an assistant set up could not be found by
// its name. `@wizeworks/scheduling` cannot publish events itself (it does not
// depend on `@wizeworks/events`), so the tools are wrapped here, at the one
// place they are registered, and signal once the write has returned (committed).

import { withTenant } from '@wizeworks/db';
import { indexEntity } from '@wizeworks/events';

/** The part of a tool definition this needs. Declared here rather than taken
 *  from `tool-registry.ts`, which imports this file. */
interface WrappableTool {
  name: string;
  run(ctx: { tenantId: string; userId: string }, input: unknown): Promise<unknown>;
}

type Read = (input: unknown, result: unknown) => string | undefined;

function field(value: unknown, name: string): string | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const v = (value as Record<string, unknown>)[name];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** The id a write tool acted on: what it made, else what it was asked to change. */
const fromResultOrInput: Read = (input, result) => field(result, 'id') ?? field(input, 'id');

interface Signal {
  entityType: string;
  id: Read;
  /** A staff resource and a person on the team are one roster: re-read both. */
  person?: boolean;
}

const SIGNALS: Readonly<Record<string, Signal>> = {
  create_scheduling_service: { entityType: 'scheduling_service', id: fromResultOrInput },
  update_scheduling_service: { entityType: 'scheduling_service', id: fromResultOrInput },
  delete_scheduling_service: { entityType: 'scheduling_service', id: fromResultOrInput },
  create_scheduling_resource: {
    entityType: 'scheduling_resource',
    id: fromResultOrInput,
    person: true,
  },
  update_scheduling_resource: {
    entityType: 'scheduling_resource',
    id: fromResultOrInput,
    person: true,
  },
  delete_scheduling_resource: {
    entityType: 'scheduling_resource',
    id: fromResultOrInput,
    person: true,
  },
  create_scheduling_location: { entityType: 'scheduling_location', id: fromResultOrInput },
  update_scheduling_location: { entityType: 'scheduling_location', id: fromResultOrInput },
  delete_scheduling_location: { entityType: 'scheduling_location', id: fromResultOrInput },
  create_booking_policy: { entityType: 'booking_policy', id: fromResultOrInput },
  update_booking_policy: { entityType: 'booking_policy', id: fromResultOrInput },
  delete_booking_policy: {
    entityType: 'booking_policy',
    id: (input) => field(input, 'policyId'),
  },
};

async function signal(
  ctx: { tenantId: string; userId: string },
  how: Signal,
  recordId: string
): Promise<void> {
  const by = { tenantId: ctx.tenantId, actorId: ctx.userId };
  await indexEntity({ ...by, entityType: how.entityType, recordId });
  if (!how.person) return;
  const person = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.staffMember.findFirst({ where: { resourceId: recordId }, select: { id: true } })
  );
  if (person) await indexEntity({ ...by, entityType: 'staff_member', recordId: person.id });
}

/** The Bookings tools, each write followed by its search signal. A failed signal
 *  never fails the tool: the write has already happened. */
export function withSchedulingSearch<T extends WrappableTool>(tools: readonly T[]): T[] {
  return tools.map((tool) => {
    const how = SIGNALS[tool.name];
    if (!how) return tool;
    const wrapped: T = {
      ...tool,
      run: async (ctx: { tenantId: string; userId: string }, input: unknown) => {
        const result = await tool.run(ctx, input);
        const recordId = how.id(input, result);
        if (recordId) {
          await signal(ctx, how, recordId).catch((err: unknown) => {
            console.error(
              JSON.stringify({
                level: 'error',
                msg: 'search signal after a Bookings tool failed',
                tool: tool.name,
                err: err instanceof Error ? err.message : String(err),
              })
            );
          });
        }
        return result;
      },
    };
    return wrapped;
  });
}
