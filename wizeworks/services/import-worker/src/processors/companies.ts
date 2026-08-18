// Companies — the accounts a CRM is actually organised around.
//
// Matched on name first and email domain second. Domain is the stronger signal (two
// records called "Acme" are usually one company; two with `acme.com` always are), but
// only HubSpot and Salesforce export it reliably, so name carries most files.
//
// The owner column is resolved to a real team member where one exists and left
// unassigned where one does not. An import does not get to invite people into a
// tenant as a side effect.

import { companyService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { toDecimal, toInteger, toList } from '@wizeworks/migration';

import { Resolver } from './resolve';
import { eachRow, type EntityProcessor, type PreviewResult, type RowResult } from './types';

/** `https://www.acme.com/about` → `acme.com`. The export column is called a website
 *  and contains anything from a bare domain to a tracking URL. */
function domainOf(value: string | undefined): string | undefined {
  const text = (value ?? '').trim().toLowerCase();
  if (text === '') return undefined;
  const stripped = text
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]!
    .trim();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(stripped) ? stripped : undefined;
}

function websiteOf(value: string | undefined): string | undefined {
  const domain = domainOf(value);
  return domain === undefined ? undefined : `https://${domain}`;
}

async function findExisting(
  ctx: { tenantId: string },
  name: string,
  domain: string | undefined
): Promise<{ id: string } | null> {
  return withTenant(ctx, (tx) =>
    tx.company.findFirst({
      where: {
        tenantId: ctx.tenantId,
        OR: [
          { companyName: { equals: name, mode: 'insensitive' } },
          ...(domain === undefined ? [] : [{ domains: { has: domain } }]),
        ],
      },
      select: { id: true },
    })
  );
}

export const companiesProcessor: EntityProcessor = {
  entity: 'companies',
  module: 'crm',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);

    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const name = (row.name ?? '').trim();
        if (name === '')
          return { rowIndex, status: 'error', errorMsg: 'This row has no company name.' };

        const domain = domainOf(row.domain);
        const existing = await findExisting(ctx, name, domain);
        if (existing !== null && !options.upsert) {
          return { rowIndex, status: 'skipped', naturalKey: name };
        }

        const assignedRepId = await resolver.userByEmail(row.owner_email ?? '');
        const revenue = toDecimal(row.annual_revenue);
        const notes = [
          (row.description ?? '').trim(),
          revenue === undefined
            ? ''
            : `Annual revenue on the old system: ${revenue.toLocaleString()}.`,
          (row.industry ?? '').trim() === '' ? '' : `Industry: ${row.industry}.`,
        ]
          .filter((line) => line !== '')
          .join('\n\n');

        const input = {
          companyName: name.slice(0, 255),
          ...(websiteOf(row.domain) !== undefined ? { website: websiteOf(row.domain) } : {}),
          ...(domain !== undefined ? { domains: [domain] } : {}),
          ...(assignedRepId !== null ? { assignedRepId } : {}),
          ...(toInteger(row.employees) !== undefined
            ? { fleetSize: toInteger(row.employees) }
            : {}),
          ...(notes === '' ? {} : { notes: notes.slice(0, 10_000) }),
          tags: toList(row.industry).slice(0, 1),
        };

        if (existing !== null) {
          await companyService.update(ctx, existing.id, input);
          resolver.rememberCompany(name, existing.id);
          return { rowIndex, status: 'updated', naturalKey: name };
        }

        const created = await companyService.create(ctx, input);
        resolver.rememberCompany(name, created.id);
        return { rowIndex, status: 'imported', naturalKey: name };
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
        if (name === '') return { rowIndex, action: 'error', errorMsg: 'No company name.' };
        const existing = await findExisting(ctx, name, domainOf(row.domain));
        return { rowIndex, action: existing === null ? 'create' : 'update', naturalKey: name };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
