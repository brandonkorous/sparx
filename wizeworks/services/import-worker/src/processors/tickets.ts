// Support tickets.
//
// Imported history is what makes a support queue usable on day one: the whole value
// of opening a customer's record is seeing that they have asked this before. A
// migration that starts the queue empty makes every agent's first week worse than
// their last one on the old system.
//
// Unlike deals, tickets do not need a pipeline named in the file — the service falls
// back to the tenant's default ticket pipeline and its first stage, which is right
// for the common case of a queue with one flow. A named pipeline in the export is
// still honoured where the tenant already has one by that name.

import { ticketService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';

import { Resolver } from './resolve';
import { eachRow, type EntityProcessor, type PreviewResult, type RowResult } from './types';

/** Our priorities are low / medium / high / urgent; every vendor spells them
 *  differently and several use numbers. */
function priorityOf(value: string | undefined): 'low' | 'medium' | 'high' | 'urgent' {
  const text = (value ?? '').trim().toLowerCase();
  if (text === 'urgent' || text === 'critical' || text === '1') return 'urgent';
  if (text === 'high' || text === '2') return 'high';
  if (text === 'low' || text === '4') return 'low';
  return 'medium';
}

export const ticketsProcessor: EntityProcessor = {
  entity: 'tickets',
  module: 'crm',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const subject = (row.subject ?? '').trim();
        if (subject === '')
          return { rowIndex, status: 'error', errorMsg: 'This row has no subject.' };

        const existing = await withTenant(ctx, (tx) =>
          tx.ticket.findFirst({
            where: { tenantId: ctx.tenantId, subject: { equals: subject, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: subject };
        }

        const customerId = await resolver.customerByEmail(row.contact_email ?? '');
        const companyId = await resolver.companyByName(row.company ?? '');
        const assignedToUserId = await resolver.userByEmail(row.owner_email ?? '');

        const input = {
          subject: subject.slice(0, 255),
          ...(row.description !== undefined && row.description !== ''
            ? { description: row.description.slice(0, 20_000) }
            : {}),
          priority: priorityOf(row.priority),
          // Imported, not raised here — an agent looking at the record should be able
          // to tell that this arrived with the migration rather than through a form.
          source: 'manual' as const,
          ...(ctx.propertyId != null ? { propertyId: ctx.propertyId } : {}),
          ...(customerId !== null ? { customerId } : {}),
          ...(companyId !== null ? { companyId } : {}),
          ...(assignedToUserId !== null ? { assignedToUserId } : {}),
        };

        if (existing !== null) {
          await ticketService.update(ctx, existing.id, input);
          return { rowIndex, status: 'updated', naturalKey: subject };
        }

        await ticketService.create(ctx, input);
        return { rowIndex, status: 'imported', naturalKey: subject };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const subject = (row.subject ?? '').trim();
        if (subject === '') return { rowIndex, action: 'error', errorMsg: 'No subject.' };
        const existing = await withTenant(ctx, (tx) =>
          tx.ticket.findFirst({
            where: { tenantId: ctx.tenantId, subject: { equals: subject, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: subject };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
