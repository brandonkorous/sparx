// Customer row processor for CSV import.
//
// Natural key: email. Upsert semantics:
//   - Row has a matching email → update first/last name, company, phone, type, tags.
//   - No matching email → create new customer.
//
// Required columns: email (for upsert lookup; otherwise creates a no-email prospect).
//
// Column aliases (case-insensitive):
//   email, first_name, last_name, company, phone, job_title, type, tags
//
// Any OTHER column that names one of the tenant's declared properties (docs/144
// §3) is imported into `custom_properties`: a business that tracks "Warranty
// expires" on their customers has that column in the spreadsheet they are
// importing, and dropping it silently is the failure this guards against.

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import {
  customerService,
  describeColumnProblems,
  objectDefService,
  propertiesFromRow,
} from '@sparx/crm';

export interface CustomerRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  job_title?: string;
  type?: string;
  tags?: string;
  [key: string]: string | undefined;
}

export interface RowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string;
  errorMsg?: string;
}

// The imported "type" column is the RELATIONSHIP (docs/137). An imported contact
// defaults to a retail individual and, unset, lands at the `lead` lifecycle stage
// (the schema default) — a reclassification, not a purchase.
function normalizeType(val: string | undefined): 'retail' | 'b2b' | 'partner' | 'vendor' {
  if (val === 'b2b' || val === 'wholesale') return 'b2b';
  if (val === 'partner') return 'partner';
  if (val === 'vendor') return 'vendor';
  return 'retail';
}

/** The headers the mapping above already owns — see `propertiesFromRow`. */
const RESERVED_COLUMNS = [
  'email',
  'first_name',
  'last_name',
  'company',
  'phone',
  'job_title',
  'type',
  'tags',
] as const;

export async function processCustomerRows(
  ctx: { tenantId: string },
  rows: CustomerRow[],
  opts: { upsert: boolean },
  logger: Logger
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  // Read ONCE for the whole file, not per row: the schema cannot change
  // mid-import, and a 10,000-row file would otherwise be 10,000 identical
  // queries.
  const schema = await objectDefService.schemaFor(ctx, 'contact');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const emailRaw = row.email?.trim().toLowerCase();
    const email = emailRaw !== '' ? emailRaw : undefined;
    const log = logger.child({ rowIndex: i, email });

    try {
      const extra = propertiesFromRow(schema, row, RESERVED_COLUMNS);
      // A cell we could not read fails the ROW. Importing the rest of it and
      // saying nothing is how a business ends up with three hundred contacts
      // whose renewal date is quietly missing.
      if (extra.problems.length > 0) {
        results.push({
          rowIndex: i,
          status: 'error',
          naturalKey: email,
          errorMsg: describeColumnProblems(extra.problems),
        });
        log.warn({ problems: extra.problems }, 'row has unreadable extra details');
        continue;
      }
      const customProperties =
        Object.keys(extra.values).length > 0 ? { customProperties: extra.values } : {};

      // Look up existing customer by email (if provided).
      let existing: { id: string } | null = null;
      if (email) {
        existing = await withTenant(ctx, (tx) =>
          tx.customer.findFirst({
            where: { tenantId: ctx.tenantId, email, deletedAt: null },
            select: { id: true },
          })
        );
      }

      if (existing && opts.upsert) {
        await customerService.update(ctx, existing.id, {
          ...(row.first_name !== undefined ? { firstName: row.first_name } : {}),
          ...(row.last_name !== undefined ? { lastName: row.last_name } : {}),
          ...(row.company !== undefined ? { companyName: row.company } : {}),
          ...(row.phone !== undefined ? { phone: row.phone } : {}),
          ...(row.job_title !== undefined ? { jobTitle: row.job_title } : {}),
          ...(row.type ? { type: normalizeType(row.type) } : {}),
          ...(row.tags
            ? {
                tags: row.tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              }
            : {}),
          ...customProperties,
        });
        results.push({ rowIndex: i, status: 'updated', naturalKey: email });
        log.debug('updated');
      } else if (existing && !opts.upsert) {
        results.push({ rowIndex: i, status: 'skipped', naturalKey: email });
        log.debug('skipped (upsert off)');
      } else {
        await customerService.create(ctx, {
          type: normalizeType(row.type),
          email: email ?? null,
          firstName: row.first_name ?? null,
          lastName: row.last_name ?? null,
          companyName: row.company ?? null,
          phone: row.phone ?? null,
          jobTitle: row.job_title ?? null,
          tags: row.tags
            ? row.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          doNotContact: false,
          ...customProperties,
        });
        results.push({ rowIndex: i, status: 'imported', naturalKey: email });
        log.debug('imported');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey: email, errorMsg: msg });
    }
  }

  return results;
}
