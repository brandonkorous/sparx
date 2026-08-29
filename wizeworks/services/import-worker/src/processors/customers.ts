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
import { withTenant } from '@wizeworks/db';
import {
  checkCustomerInput,
  customerService,
  describeColumnProblems,
  describeCustomerError,
  objectDefService,
  propertiesFromRow,
} from '@wizeworks/crm';

import type { EntityProcessor, PreviewResult } from './types';

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

const AFFIRMATIVE = ['true', 'yes', 'y', '1', 'subscribed', 'subscriber', 'opted_in', 'opted in'];

/** An explicit yes in the opt-in column, and nothing else. Both readings below
 *  hang off this, so they can never disagree about what the cell said. */
function saidYes(value: string | undefined): boolean {
  return AFFIRMATIVE.includes((value ?? '').trim().toLowerCase());
}

/**
 * Marketing consent, which is the one field on this row that has legal weight.
 *
 * Only an explicit yes becomes permission. Anything else — blank, unrecognised, an
 * unconfirmed Mailchimp opt-in — lands as do-not-contact, because the failure modes
 * are not symmetric: a contact wrongly marked no can be asked again, and a contact
 * wrongly marked yes is an unlawful send the tenant finds out about from a complaint.
 */
function doNotContactFrom(value: string | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase();
  if (text === '') return false;
  return !saidYes(text);
}

/**
 * The consent RECORD behind that yes, which is a separate thing from the flag.
 *
 * `doNotContact: false` only says nobody has objected; being subscribed needs
 * `gdpr_consent.scope` to hold `marketing`, and nothing here ever wrote it. So a
 * shop mapped its opt-in column, imported its mailing list, opened the built-in
 * "Newsletter Subscribers" group and found it empty — with every contact showing
 * as contactable one screen away.
 *
 * No `grantedAt`: the file does not say when they agreed, and stamping the import
 * time would put a date on a consent record that nobody measured. `source` records
 * where it came from instead, which is the part we actually know.
 */
function consentFrom(value: string | undefined): { scope: ['marketing']; source: 'import' } | null {
  return saidYes(value) ? { scope: ['marketing'], source: 'import' } : null;
}

/**
 * The same flag on somebody who is ALREADY here, where it is one-way.
 *
 * A file saying "do not email" is a person asking not to be emailed and is always
 * honoured. A file saying "email them" is not a fresh permission — it is the file
 * being SILENT about everything that happened after it was exported, including the
 * unsubscribe that happened last week. The asymmetry the comment above describes is
 * sharper on a re-import: the wrong yes is not a guess, it is an undo, and the only
 * person who knows it happened is the one who complains.
 *
 * So the flag can be turned ON here and never OFF. Returns the field to write plus
 * the note owed to the run report — the one thing worse than overriding her file is
 * overriding it without saying so.
 */
function optInForExisting(
  value: string | undefined,
  suppressed: boolean
): { field: { doNotContact: boolean } | null; note: string | null } {
  if (value === undefined) return { field: null, note: null };
  if (doNotContactFrom(value)) return { field: { doNotContact: true }, note: null };
  if (!suppressed) return { field: null, note: null };
  return {
    field: null,
    note: 'This file has them down as happy to be emailed, but they have been taken off marketing here since it was made. They stay off it.',
  };
}

/** Everything the row has to say, as one sentence for the run report. */
function joinNotes(notes: (string | null)[]): string | null {
  const said = notes.filter((note): note is string => note !== null);
  return said.length === 0 ? null : said.join(' ');
}

/**
 * The two-letter code an address needs, from whatever the spreadsheet says.
 *
 * Short on purpose. A shop's own list writes the country the way a person says it,
 * and `CreateCustomerAddressInput` will only take ISO alpha-2 — so without this the
 * entire address is refused over the word "United States". Anything not here is not
 * guessed at: the contact still lands and the row carries a note saying the address
 * did not, which is recoverable. A wrong country on a parcel is not.
 */
const COUNTRY_CODES: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  america: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  canada: 'CA',
  australia: 'AU',
  'new zealand': 'NZ',
  ireland: 'IE',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  mexico: 'MX',
};

function countryCode(value: string | undefined): string | null {
  const text = (value ?? '').trim();
  if (text === '') return null;
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  return COUNTRY_CODES[text.toLowerCase()] ?? null;
}

interface ImportedAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
}

/**
 * The address on a contact row, when there is a whole one.
 *
 * `address1`, `city`, `province`, `country` and `zip` were listed as reserved
 * columns from the beginning — so the mapper offered them, the tenant assigned
 * them, and nothing ever wrote them. Every street address in the file was read,
 * claimed and dropped in silence (persona issue 230).
 *
 * Returns a reason instead of an address when the file has SOME of one: an
 * incomplete address is worth telling somebody about, and no address at all is not.
 */
function addressFrom(row: CustomerRow): { address: ImportedAddress } | { note: string } | null {
  const line1 = (row.address1 ?? '').trim();
  const city = (row.city ?? '').trim();
  const rawCountry = (row.country ?? '').trim();
  const parts = [line1, city, rawCountry, (row.zip ?? '').trim(), (row.province ?? '').trim()];
  if (parts.every((part) => part === '')) return null;

  if (line1 === '' || city === '')
    return { note: 'Their address needs at least a street line and a town to be saved.' };

  const country = countryCode(rawCountry);
  if (country === null)
    return {
      note:
        rawCountry === ''
          ? 'Their address needs a country to be saved.'
          : `We could not tell which country “${rawCountry}” is, so their address was not saved.`,
    };

  const line2 = (row.address2 ?? '').trim();
  const region = (row.province ?? '').trim();
  const postalCode = (row.zip ?? '').trim();
  return {
    address: {
      line1,
      city,
      country,
      ...(line2 === '' ? {} : { line2 }),
      ...(region === '' ? {} : { region }),
      ...(postalCode === '' ? {} : { postalCode }),
    },
  };
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
  'accepts_marketing',
  'accepts_sms',
  'name',
  'note',
  'total_spent',
  'total_orders',
  'created_at',
  'address1',
  'address2',
  'city',
  'province',
  'country',
  'zip',
] as const;

/**
 * Write the row's address, and say so when it could not be.
 *
 * On a customer who is already here it is added only when they have NO address:
 * their address book is theirs, and a file imported twice must not leave them with
 * the same street on file three times. Returns a note for the run report, or null
 * when there was nothing to say.
 */
async function saveAddress(
  ctx: { tenantId: string },
  customerId: string,
  row: CustomerRow,
  isNew: boolean
): Promise<string | null> {
  const found = addressFrom(row);
  if (found === null) return null;
  if ('note' in found) return found.note;

  if (!isNew) {
    const already = await customerService.listAddresses(ctx, customerId);
    if (already.length > 0) return 'They already had an address on file, so this one was left off.';
  }

  await customerService.addAddress(ctx, customerId, {
    type: 'both',
    isDefault: true,
    ...found.address,
  });
  return null;
}

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
      let existing: { id: string; doNotContact: boolean } | null = null;
      if (email) {
        existing = await withTenant(ctx, (tx) =>
          tx.customer.findFirst({
            where: { tenantId: ctx.tenantId, email, deletedAt: null },
            select: { id: true, doNotContact: true },
          })
        );
      }

      const consent = consentFrom(row.accepts_marketing);

      if (existing && opts.upsert) {
        const optIn = optInForExisting(row.accepts_marketing, existing.doNotContact);
        await customerService.update(ctx, existing.id, {
          ...(row.first_name !== undefined ? { firstName: row.first_name } : {}),
          ...(row.last_name !== undefined ? { lastName: row.last_name } : {}),
          ...(row.company !== undefined ? { companyName: row.company } : {}),
          ...(row.phone !== undefined ? { phone: row.phone } : {}),
          ...(row.job_title !== undefined ? { jobTitle: row.job_title } : {}),
          ...(row.type ? { type: normalizeType(row.type) } : {}),
          // One-way — see optInForExisting. This line used to write the file's
          // answer in both directions, so re-importing a months-old export put
          // everyone who had unsubscribed since back on the list.
          ...(optIn.field ?? {}),
          // Only ever ADDED on an update. A file saying no already lands as
          // do-not-contact, which is what stops the send; erasing the record of a
          // consent they once gave would destroy the evidence for sends already made.
          ...(consent === null ? {} : { gdprConsent: consent }),
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
        const note = joinNotes([await saveAddress(ctx, existing.id, row, false), optIn.note]);
        results.push({
          rowIndex: i,
          status: 'updated',
          naturalKey: email,
          ...(note === null ? {} : { errorMsg: note }),
        });
        log.debug('updated');
      } else if (existing && !opts.upsert) {
        // Nothing counts a skip — the job carries imported, updated and errors and
        // no third column — so without this the row is simply absent from every
        // number on the screen, and 25 rows report as 0 with no reason given.
        results.push({
          rowIndex: i,
          status: 'skipped',
          naturalKey: email,
          errorMsg:
            'They are already here, and this import was set to leave people it already has alone.',
        });
        log.debug('skipped (upsert off)');
      } else {
        const created = await customerService.create(ctx, {
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
          doNotContact: doNotContactFrom(row.accepts_marketing),
          ...(consent === null ? {} : { gdprConsent: consent }),
          ...customProperties,
        });
        const note = await saveAddress(ctx, created.id, row, true);
        results.push({
          rowIndex: i,
          status: 'imported',
          naturalKey: email,
          ...(note === null ? {} : { errorMsg: note }),
        });
        log.debug('imported');
      }
    } catch (err) {
      // A rejected row is read by the person whose spreadsheet it came from, so
      // a schema failure is turned into a sentence rather than handed over as
      // `ZodError.message`, which is a JSON array (persona issue 233).
      const msg = describeCustomerError(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey: email, errorMsg: msg });
    }
  }

  return results;
}

/**
 * What each row WOULD do, resolved against the contacts already here.
 *
 * The customers processor used the shared legacy wrapper, whose preview calls every
 * row a `create` because the three processors it wraps resolve their natural keys
 * inside the write path. Customers do not — the match is one lookup by email — and
 * the screen offering the practice run says it "checks every row against what you
 * already have and shows you exactly what would happen". It did not: a list whose
 * every name is already a customer previewed as 25 brand-new people (issue 231).
 *
 * One query for the file, not one per row: a 10,000-row list would otherwise be
 * 10,000 round trips to answer a question about a set we can fetch once.
 */
export async function previewCustomerRows(
  ctx: { tenantId: string },
  rows: CustomerRow[],
  opts: { upsert: boolean }
): Promise<PreviewResult[]> {
  const emails = [
    ...new Set(
      rows.map((row) => row.email?.trim().toLowerCase()).filter((email): email is string => !!email)
    ),
  ];

  // Who is here, and which of them have asked not to be emailed — the second half
  // because the write will refuse to un-ask that, and a practice run that does not
  // mention it leaves her expecting the file's opt-in to apply.
  const here = new Map<string, { suppressed: boolean }>();
  if (emails.length > 0) {
    const found = await withTenant(ctx, (tx) =>
      tx.customer.findMany({
        where: { tenantId: ctx.tenantId, email: { in: emails }, deletedAt: null },
        select: { email: true, doNotContact: true },
      })
    );
    for (const row of found) {
      if (row.email) here.set(row.email.toLowerCase(), { suppressed: row.doNotContact });
    }
  }

  return rows.map((row, rowIndex) => {
    const email = row.email?.trim().toLowerCase();
    const key = email === undefined || email === '' ? {} : { naturalKey: email };

    // Would the write REFUSE this row? A preview that only answers
    // create-or-update is answering half the question: the first practice run of
    // a real mailing list reported 25 rows and no problems, and the import that
    // followed rejected ten of them over a tag with a space in it. The screen
    // says the practice run shows "exactly what would happen", so it has to run
    // the same validation the write does.
    const refusal = wouldRefuse(row);
    if (refusal !== null) return { rowIndex, action: 'error' as const, errorMsg: refusal, ...key };

    const known = email === undefined || email === '' ? undefined : here.get(email);
    if (known === undefined) return { rowIndex, action: 'create' as const, ...key };
    if (!opts.upsert) {
      return {
        rowIndex,
        action: 'skip' as const,
        errorMsg:
          'They are already here, and this import was set to leave people it already has alone.',
        ...key,
      };
    }
    const note = optInForExisting(row.accepts_marketing, known.suppressed).note;
    return {
      rowIndex,
      action: 'update' as const,
      ...(note === null ? {} : { errorMsg: note }),
      ...key,
    };
  });
}

/**
 * The reason the write would reject this row, or null.
 *
 * Runs the row through the SAME schema `customerService.create` parses it with,
 * so the two cannot disagree. Deliberately not a second list of rules — a copy
 * would drift, and drift here means the practice run lying again.
 */
function wouldRefuse(row: CustomerRow): string | null {
  return checkCustomerInput({
    type: normalizeType(row.type),
    email: row.email?.trim() ? row.email.trim() : null,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    companyName: row.company ?? null,
    phone: row.phone ?? null,
    jobTitle: row.job_title ?? null,
    tags: tagsFrom(row.tags),
    doNotContact: doNotContactFrom(row.accepts_marketing),
  });
}

/** One spreadsheet cell of comma-separated tags, as a list. */
function tagsFrom(cell: string | undefined): string[] {
  return cell
    ? cell
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

/** The customers entity, with a preview that is actually a preview. */
export const customersProcessor: EntityProcessor = {
  entity: 'customers',
  module: 'crm',
  run: (ctx, rows, options, logger) =>
    processCustomerRows(ctx, rows, { upsert: options.upsert }, logger),
  preview: (ctx, rows) => previewCustomerRows(ctx, rows, { upsert: true }),
};

/** The pure halves, for the suite that pins down the quiet mistakes. */
export const customerInternals = { doNotContactFrom, consentFrom, optInForExisting, joinNotes };
