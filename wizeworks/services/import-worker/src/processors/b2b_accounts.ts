// B2B account row processor, shared by "Move in" (/v1/migration/runs) and the
// trade-account CSV import (/v1/b2b/accounts/import).
//
// Natural key: company_name. Upsert semantics:
//   - Row matches an existing company_name → update fields.
//   - No match → create new B2B account.
//
// THE COLUMNS ARE THE CANONICAL FIELD KEYS. `ENTITY_FIELDS.b2b_accounts` in
// @wizeworks/migration is the contract: it is what the Move-in column mapper offers,
// what the validator checks, and what this file reads, with no translation between
// them. The two lists once disagreed (`name`/`tier` there, `company_name`/
// `pricing_tier` here), and every trade account a Move-in carried failed with
// "company_name is required". `B2B_ACCOUNT_COLUMNS` below is held equal to that list
// by the processor tests, so they cannot drift apart again.
//
// Values are read with the same coercers the validator uses, so a value the preview
// accepted is the value that lands.
//
// Any OTHER column that names one of the tenant's declared company properties
// (docs/144 §3) is imported into `custom_properties`.

import type { Logger } from 'pino';
import {
  b2bAccountContactService,
  companyService,
  CrmConflictError,
  describeColumnProblems,
  objectDefService,
  propertiesFromRow,
} from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { toCents, toDecimal, toList } from '@wizeworks/migration';

export interface B2bAccountRow {
  company_name?: string;
  email?: string;
  pricing_tier?: string;
  payment_terms?: string;
  credit_limit?: string;
  discount_percent?: string;
  tax_id?: string;
  website?: string;
  status?: string;
  notes?: string;
  tags?: string;
  [key: string]: string | undefined;
}

export interface RowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string;
  errorMsg?: string;
}

/** Every column this processor reads. Equal to the canonical field keys; see above. */
export const B2B_ACCOUNT_COLUMNS = [
  'company_name',
  'email',
  'pricing_tier',
  'payment_terms',
  'credit_limit',
  'discount_percent',
  'tax_id',
  'website',
  'status',
  'notes',
  'tags',
] as const;

const PAYMENT_TERMS = ['prepay', 'net30', 'net60', 'net90'] as const;
type PaymentTerms = (typeof PAYMENT_TERMS)[number];

const STATUSES = ['active', 'credit_hold', 'suspended', 'inactive'] as const;
type AccountStatus = (typeof STATUSES)[number];

/** Trim a cell; a blank/whitespace-only cell becomes undefined so it falls to the
 *  column default rather than persisting an empty string. */
function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;
  return trimmed;
}

/** Case-insensitive, the way the validator matches an enum. */
function oneOf<T extends string>(values: readonly T[], raw: string | undefined): T | undefined {
  const text = blank(raw)?.toLowerCase();
  return values.find((value) => value === text);
}

/** A full web address, or undefined. The account stores a real URL, and exports
 *  routinely carry a bare `acme.com`, which is the same site. */
function websiteOf(raw: string | undefined): string | undefined {
  const text = blank(raw);
  if (text === undefined) return undefined;
  const url = /^https?:\/\//i.test(text)
    ? text
    : /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text)
      ? `https://${text}`
      : undefined;
  if (url === undefined || url.length > 2048) return undefined;
  try {
    return new URL(url).protocol.startsWith('http') ? url : undefined;
  } catch {
    return undefined;
  }
}

/** One row, read into the account's own fields. Absent means "the file says nothing";
 *  `notes` lists what was set aside, so the run report can say so. */
export interface ReadAccountRow {
  companyName: string | undefined;
  email: string | undefined;
  /** The `pricing_tier` cell: the NAME of a tier, linked by `linkTier`. */
  tierName: string | undefined;
  paymentTerms: PaymentTerms | undefined;
  creditLimit: number | undefined;
  discountPercent: number | undefined;
  taxId: string | undefined;
  website: string | undefined;
  status: AccountStatus | undefined;
  notes: string | undefined;
  tags: string[] | undefined;
  setAside: string[];
}

export function readAccountRow(row: B2bAccountRow): ReadAccountRow {
  const setAside: string[] = [];

  const paymentTerms = oneOf(PAYMENT_TERMS, row.payment_terms);
  if (paymentTerms === undefined && blank(row.payment_terms) !== undefined) {
    setAside.push(
      `Payment terms “${blank(row.payment_terms)}” is not one of ${PAYMENT_TERMS.join(', ')}, so the payment terms were not set from it.`
    );
  }
  const status = oneOf(STATUSES, row.status);
  if (status === undefined && blank(row.status) !== undefined) {
    setAside.push(
      `Status “${blank(row.status)}” is not one of ${STATUSES.join(', ')}, so the status was not set from it.`
    );
  }

  const website = websiteOf(row.website);
  if (website === undefined && blank(row.website) !== undefined) {
    setAside.push(`Website “${blank(row.website)}” is not a web address, so it was left empty.`);
  }

  const cents = toCents(row.credit_limit);
  const creditLimit = cents === undefined || cents < 0 ? undefined : cents / 100;
  if (cents !== undefined && cents < 0) {
    setAside.push('A credit limit cannot be below zero, so it was not set from this row.');
  }
  const discount = toDecimal(row.discount_percent);
  const discountPercent =
    discount === undefined || discount < 0 || discount > 100 ? undefined : discount;
  if (discount !== undefined && discountPercent === undefined) {
    setAside.push(
      `A discount of ${discount}% is not between 0 and 100, so it was not set from this row.`
    );
  }
  const tags = blank(row.tags) === undefined ? undefined : toList(row.tags);

  return {
    companyName: blank(row.company_name)?.slice(0, 255),
    email: blank(row.email),
    tierName: blank(row.pricing_tier)?.slice(0, 63),
    paymentTerms,
    creditLimit,
    discountPercent,
    taxId: blank(row.tax_id)?.slice(0, 64),
    website,
    status,
    notes: blank(row.notes),
    tags,
    setAside,
  };
}

/** The pricing tier with this name, case-insensitively, cached for the run. */
async function tierByName(
  ctx: { tenantId: string },
  cache: Map<string, string | null>,
  name: string
): Promise<string | null> {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const tier = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.findFirst({
      where: {
        tenantId: ctx.tenantId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    })
  );
  cache.set(key, tier?.id ?? null);
  return tier?.id ?? null;
}

/**
 * Point the account at the named pricing tier, so the tier actually prices its orders.
 *
 * Pricing reads `pricingTierId`, and the id is all that is written. The importer
 * also used to copy the name into the legacy free-text column, which priced
 * nothing; a name with no matching tier left the account LOOKING like it was on
 * that tier while it paid list price (sparx persona issue 086). Now an unmatched
 * name writes nothing and is reported instead.
 */
async function linkTier(
  ctx: { tenantId: string },
  cache: Map<string, string | null>,
  accountId: string,
  name: string
): Promise<string | null> {
  const tierId = await tierByName(ctx, cache, name);
  if (tierId === null) {
    return `There is no pricing tier called “${name}” yet, so this account is priced at list until you create that tier and choose it on the account.`;
  }
  // Through the company's own save, like every other field this import writes:
  // one write path, so whatever a save of an account's tier has to do (close
  // its "Set up prices and terms" task once it is set up, say) happens here too.
  await companyService.update(ctx, accountId, { pricingTierId: tierId });
  return null;
}

/** Link the customer with this email as the account's primary contact. */
async function linkPrimaryContact(
  ctx: { tenantId: string },
  accountId: string,
  email: string
): Promise<string | null> {
  const customer = await withTenant(ctx, (tx) =>
    tx.customer.findFirst({
      where: {
        tenantId: ctx.tenantId,
        email: { equals: email, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    })
  );
  if (customer === null) {
    return `No customer has the email ${email}, so no contact was linked. Add them as a customer (or include them in the same import) and run it again.`;
  }

  const primary = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { tenantId: ctx.tenantId, accountId, role: 'primary_contact', isActive: true },
      select: { customerId: true },
    })
  );
  if (primary?.customerId === customer.id) return null;

  try {
    await b2bAccountContactService.create(ctx, accountId, {
      customerId: customer.id,
      role: primary === null ? 'primary_contact' : 'buyer',
    });
  } catch (err) {
    // Already an active contact on this account in some other role: linked already.
    if (err instanceof CrmConflictError) return null;
    throw err;
  }
  return primary === null
    ? null
    : `This account already had a primary contact, so ${email} was added as a buyer.`;
}

/** The headers the mapping above already owns — see `propertiesFromRow`. */
const RESERVED_COLUMNS = B2B_ACCOUNT_COLUMNS;

export async function processB2bAccountRows(
  ctx: { tenantId: string },
  rows: B2bAccountRow[],
  opts: { upsert: boolean },
  logger: Logger
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  const tiers = new Map<string, string | null>();

  // Once for the file — the schema cannot change mid-import.
  const schema = await objectDefService.schemaFor(ctx, 'company');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const read = readAccountRow(row);
    const companyName = read.companyName;
    const log = logger.child({ rowIndex: i, companyName });

    if (!companyName) {
      results.push({
        rowIndex: i,
        status: 'error',
        errorMsg: 'This row has no account name.',
      });
      continue;
    }

    try {
      const existing = await withTenant(ctx, (tx) =>
        tx.company.findFirst({
          where: { tenantId: ctx.tenantId, companyName, deletedAt: null },
          select: { id: true },
        })
      );

      const extra = propertiesFromRow(schema, row, RESERVED_COLUMNS);
      if (extra.problems.length > 0) {
        results.push({
          rowIndex: i,
          status: 'error',
          naturalKey: companyName,
          errorMsg: describeColumnProblems(extra.problems),
        });
        log.warn({ problems: extra.problems }, 'row has unreadable extra details');
        continue;
      }
      const customProperties =
        Object.keys(extra.values).length > 0 ? { customProperties: extra.values } : {};

      if (existing && !opts.upsert) {
        results.push({ rowIndex: i, status: 'skipped', naturalKey: companyName });
        log.debug('skipped (upsert off)');
        continue;
      }

      let accountId: string;
      let status: 'imported' | 'updated';
      if (existing) {
        // Only what the file says. A blank cell leaves the stored value alone.
        await companyService.update(ctx, existing.id, {
          companyName,
          ...(read.taxId !== undefined ? { taxId: read.taxId } : {}),
          ...(read.website !== undefined ? { website: read.website } : {}),
          ...(read.creditLimit !== undefined ? { creditLimit: read.creditLimit } : {}),
          ...(read.paymentTerms !== undefined ? { paymentTerms: read.paymentTerms } : {}),
          ...(read.discountPercent !== undefined ? { discountPercent: read.discountPercent } : {}),
          ...(read.status !== undefined ? { status: read.status } : {}),
          ...(read.notes !== undefined ? { notes: read.notes } : {}),
          ...(read.tags !== undefined ? { tags: read.tags } : {}),
          ...customProperties,
        });
        accountId = existing.id;
        status = 'updated';
      } else {
        const created = await companyService.create(ctx, {
          companyName,
          taxId: read.taxId ?? null,
          website: read.website ?? null,
          creditLimit: read.creditLimit ?? 0,
          paymentTerms: read.paymentTerms ?? null,
          discountPercent: read.discountPercent ?? 0,
          status: read.status ?? 'active',
          notes: read.notes ?? null,
          tags: read.tags ?? [],
          ...customProperties,
        });
        accountId = created.id;
        status = 'imported';
      }

      const notes = [...read.setAside];
      if (read.tierName !== undefined) {
        const note = await linkTier(ctx, tiers, accountId, read.tierName);
        if (note !== null) notes.push(note);
      }
      if (read.email !== undefined) {
        const note = await linkPrimaryContact(ctx, accountId, read.email);
        if (note !== null) notes.push(note);
      }

      results.push({
        rowIndex: i,
        status,
        naturalKey: companyName,
        ...(notes.length > 0 ? { errorMsg: notes.join(' ') } : {}),
      });
      log.debug(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey: companyName, errorMsg: msg });
    }
  }

  return results;
}
