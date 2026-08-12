// Segments — the lists a tenant's email programme is built on.
//
// An imported list is always STATIC, and that is a deliberate choice rather than a
// limitation. The old platform's list was defined by rules we cannot see (Klaviyo
// conditions, a Mailchimp saved segment, a HubSpot active list), and inventing a rule
// that "looks about right" would produce a list whose membership silently differs
// from the one the tenant has been mailing for three years. A static list of exactly
// the people who were on it is the only faithful import — and the tenant can convert
// it to a rule-driven one afterwards, on purpose, having seen who is in it.
//
// Membership is by email against customers already here, so this runs AFTER the
// customer import. A member we do not have is reported rather than skipped quietly:
// "1,200 of 1,340 people were matched" is the number that tells a tenant whether
// their list came across.

import { segmentService } from '@sparx/crm';
import { withTenant } from '@sparx/db';
import { toList, toSlug } from '@sparx/migration';

import { Resolver } from './resolve';
import {
  eachRow,
  type EntityProcessor,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

async function freeSlug(ctx: ProcessorContext, name: string): Promise<string> {
  const base = (toSlug(name).slice(0, 55) || 'list').replace(/^[^a-z]/, 'l');
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await withTenant(ctx, (tx) =>
      tx.segment.findFirst({
        where: { tenantId: ctx.tenantId, slug: candidate },
        select: { id: true },
      })
    );
    if (taken === null) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const segmentsProcessor: EntityProcessor = {
  entity: 'segments',
  module: 'crm',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '')
          return { rowIndex, status: 'error', errorMsg: 'This row has no list name.' };

        const existing = await withTenant(ctx, (tx) =>
          tx.segment.findFirst({
            where: { tenantId: ctx.tenantId, name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: name };
        }

        let segmentId: string;
        if (existing !== null) {
          segmentId = existing.id;
        } else {
          const created = await segmentService.create(ctx, {
            name: name.slice(0, 120),
            slug: await freeSlug(ctx, name),
            kind: 'static',
            // A static list ignores its rules, but the field is required — an `and`
            // of nothing is the honest empty predicate.
            rules: { kind: 'and', children: [{ kind: 'and', children: [] }] } as never,
            ...(row.description !== undefined && row.description !== ''
              ? { description: row.description.slice(0, 2000) }
              : {}),
            ...(ctx.propertyId != null ? { propertyId: ctx.propertyId } : {}),
          });
          segmentId = created.id;
        }

        const emails = toList(row.members);
        if (emails.length === 0) {
          return { rowIndex, status: existing === null ? 'imported' : 'updated', naturalKey: name };
        }

        const customerIds: string[] = [];
        for (const email of emails) {
          const id = await resolver.customerByEmail(email);
          if (id !== null) customerIds.push(id);
        }

        // `addMembers` caps at 1,000 per call, and a real mailing list is bigger than
        // that far more often than not.
        let added = 0;
        for (let start = 0; start < customerIds.length; start += 1000) {
          const batch = customerIds.slice(start, start + 1000);
          if (batch.length === 0) continue;
          const result = await segmentService.addMembers(
            ctx,
            segmentId,
            { customerIds: batch },
            'import'
          );
          added += result.added;
        }

        return {
          rowIndex,
          status: existing === null ? 'imported' : 'updated',
          naturalKey: name,
          ...(customerIds.length < emails.length
            ? {
                errorMsg: `${customerIds.length} of ${emails.length} people on this list are here; the rest are not customers yet. Import your contacts first, then re-run this file.`,
              }
            : { errorMsg: `${added} added to the list.` }),
        };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '') return { rowIndex, action: 'error', errorMsg: 'No list name.' };
        const existing = await withTenant(ctx, (tx) =>
          tx.segment.findFirst({
            where: { tenantId: ctx.tenantId, name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
          })
        );
        const members = toList(row.members).length;
        return {
          rowIndex,
          action: existing === null ? 'create' : 'update',
          naturalKey: name,
          ...(members > 0 ? { errorMsg: `${members} people on this list.` } : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
