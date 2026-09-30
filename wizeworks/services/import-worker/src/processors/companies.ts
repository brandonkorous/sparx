// Companies — the accounts a CRM is actually organised around.
//
// Matched on name first and email domain second. Domain is the stronger signal (two
// records called "Acme" are usually one company; two with `acme.com` always are), but
// only HubSpot and Salesforce export it reliably, so name carries most files.
//
// The owner column is resolved to a real team member where one exists and left
// unassigned where one does not. An import does not get to invite people into a
// tenant as a side effect.
//
// THE COLUMNS ARE THE CANONICAL FIELD KEYS. `ENTITY_FIELDS.companies` in
// @wizeworks/migration is what the Move-in mapper offers, and `COMPANY_COLUMNS` below
// is what this file reads; the processor test holds the two equal. Phone, address and
// created date were once offered and never read, so every company a CRM move carried
// lost them while the mapper showed them as mapped.
//
// A blank cell never clears what a company already has: every field is written only
// when the file has a value for it, and an industry is ADDED to the company's tags
// rather than replacing them, as a website's domain is added to its domains.

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

/** Every column this processor reads. Equal to the canonical field keys; see above. */
export const COMPANY_COLUMNS = [
  'name',
  'domain',
  'industry',
  'employees',
  'annual_revenue',
  'owner_email',
  'description',
] as const;

async function findExisting(
  ctx: { tenantId: string },
  name: string,
  domain: string | undefined
): Promise<{ id: string; tags: string[]; domains: string[] } | null> {
  return withTenant(ctx, (tx) =>
    tx.company.findFirst({
      where: {
        tenantId: ctx.tenantId,
        OR: [
          { companyName: { equals: name, mode: 'insensitive' } },
          ...(domain === undefined ? [] : [{ domains: { has: domain } }]),
        ],
      },
      select: { id: true, tags: true, domains: true },
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

        const industryTags = toList(row.industry).slice(0, 1);
        const tags = [...new Set([...(existing?.tags ?? []), ...industryTags])];

        // A company can own several email domains (a group, an acquired brand); the
        // file names one, so it joins the list instead of replacing it.
        const domains =
          domain === undefined
            ? undefined
            : [...new Set([...(existing?.domains ?? []), domain])].slice(0, 20);

        const input = {
          companyName: name.slice(0, 255),
          ...(websiteOf(row.domain) !== undefined ? { website: websiteOf(row.domain) } : {}),
          ...(domains !== undefined ? { domains } : {}),
          ...(assignedRepId !== null ? { assignedRepId } : {}),
          ...(toInteger(row.employees) !== undefined
            ? { fleetSize: toInteger(row.employees) }
            : {}),
          ...(notes === '' ? {} : { notes: notes.slice(0, 10_000) }),
          ...(industryTags.length > 0 ? { tags } : {}),
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
