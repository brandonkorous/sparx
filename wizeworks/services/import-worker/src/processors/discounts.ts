// Discounts.
//
// THE COLUMNS ARE THE CANONICAL FIELD KEYS: `ENTITY_FIELDS.discounts` in
// @wizeworks/migration, and nothing else. Two callers hand rows to this file — the
// Move-in mapper, and the discount CSV endpoint in api-rest — and the two used to
// speak different languages. This file read the old export's own column names
// (`name`, `value_cents`, `value_percent`, `start_at`, `end_at`,
// `total_usage_limit`) while the mapper offered `title`, `value`, `starts_at`,
// `ends_at`, `usage_limit`, so every discount a Move-in carried failed "name is
// required" and its value, dates, minimum spend and limit were dropped. The CSV
// endpoint now translates a file saved from the old export into these keys on the way
// in (`discountRowFromFile`), and the export writes these keys, so one list serves
// both. `contract.test.ts` measures what this file reads and holds it equal to
// that list.
//
// Natural key: the code. A blank cell never clears what a discount already has —
// every field is written only when the file has a value for it — and a status in the
// file only ever switches a discount ON: "expired" or "disabled" on a discount that
// is live here is the file being older than the discount, not an instruction to stop
// a promotion somebody is running.

import { discountService } from '@wizeworks/commerce';
import { withTenant } from '@wizeworks/db';
import { toCents, toDecimal, toInteger, toIsoDate } from '@wizeworks/migration';

import {
  eachRow,
  type EntityProcessor,
  type ImportRow,
  type PreviewResult,
  type ProcessorContext,
  type RowResult,
} from './types';

/** The file's discount types, and what each one is called here. */
const TYPES: Record<string, 'percent' | 'fixed' | 'free_shipping'> = {
  percentage: 'percent',
  fixed_amount: 'fixed',
  free_shipping: 'free_shipping',
};

/** Statuses that switch a discount on. The start and end dates still decide when it
 *  applies, so a scheduled one is safe to switch on now. */
const SWITCHED_ON = new Set(['active', 'scheduled']);

const MAX_CODE = 63;

interface ExistingDiscount {
  id: string;
  status: string;
  type: string;
  conditions: unknown;
}

interface Condition {
  kind: string;
  [key: string]: unknown;
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** What a row says, checked, with the reason it cannot be saved when it cannot. */
type ReadDiscount =
  | { error: string }
  | {
      code: string;
      /** Every field the row has a value for, in the service's names. */
      fields: Record<string, unknown>;
      /** The minimum spend, in cents, when the row names one. */
      minimumCents: number | undefined;
      switchOn: boolean;
      notes: string[];
    };

function readDiscountRow(row: ImportRow, existing: ExistingDiscount | null): ReadDiscount {
  const code = blank(row.code)?.toUpperCase();
  if (code === undefined) return { error: 'This discount has no code.' };
  if (code.length > MAX_CODE) {
    return {
      error: `The code “${code}” is ${code.length} characters long; a discount code can be at most ${MAX_CODE}.`,
    };
  }

  const notes: string[] = [];
  const fields: Record<string, unknown> = {};

  const title = blank(row.title);
  // A discount needs a name, and a file often has only the code. The code is what
  // the tenant already calls it, so it stands in rather than the row failing.
  if (title !== undefined) fields.name = title.slice(0, 127);
  else if (existing === null) fields.name = code;

  const description = blank(row.description);
  if (description !== undefined) fields.description = description.slice(0, 2000);

  const typeText = blank(row.type)?.toLowerCase();
  const type = typeText === undefined ? undefined : TYPES[typeText];
  if (typeText !== undefined && type === undefined) {
    return {
      error: `A “${typeText}” discount cannot be imported from a file, because what it gives away is a set of product rules a spreadsheet row does not carry. Set it up by hand.`,
    };
  }
  if (type === undefined && existing === null) {
    return {
      error:
        'This row does not say whether the discount is a percentage, an amount off, or free shipping.',
    };
  }
  if (type !== undefined) fields.type = type;
  const effectiveType = type ?? existing?.type;

  const value = toDecimal(row.value);
  if (blank(row.value) !== undefined && value === undefined) {
    return { error: `“${blank(row.value)}” is not a number, so the discount has no value.` };
  }
  if (value !== undefined) {
    if (effectiveType === 'percent') {
      if (value <= 0 || value > 100) {
        return {
          error: `A percentage discount has to be between 0 and 100; this one is ${value}.`,
        };
      }
      fields.valuePercent = value;
    } else if (effectiveType === 'fixed') {
      if (value <= 0)
        return { error: `An amount off has to be more than zero; this one is ${value}.` };
      fields.valueCents = Math.round(value * 100);
    }
  } else if (existing === null && (effectiveType === 'percent' || effectiveType === 'fixed')) {
    return {
      error:
        effectiveType === 'percent'
          ? 'This percentage discount does not say how much it takes off.'
          : 'This discount does not say how much it takes off.',
    };
  }

  const currency = blank(row.currency);
  if (currency !== undefined) {
    if (/^[A-Za-z]{3}$/.test(currency)) fields.currency = currency.toUpperCase();
    else
      notes.push(`“${currency}” is not a currency code like USD, so the currency was left unset.`);
  }

  let minimumCents: number | undefined;
  const minimum = toCents(row.minimum_amount);
  if (minimum !== undefined && minimum > 0) minimumCents = minimum;

  const usageLimit = toInteger(row.usage_limit);
  if (usageLimit !== undefined) {
    if (usageLimit > 0) fields.totalUsageLimit = usageLimit;
    else notes.push('A usage limit has to be at least 1, so the file’s limit was not applied.');
  }

  const perCustomer = toInteger(row.per_customer_limit);
  if (perCustomer !== undefined) {
    if (perCustomer > 0) fields.perCustomerLimit = perCustomer;
    else
      notes.push('Uses per customer has to be at least 1, so the file’s number was not applied.');
  }

  const startsAt = toIsoDate(row.starts_at);
  if (startsAt !== undefined) fields.startAt = startsAt;
  const endsAt = toIsoDate(row.ends_at);
  if (endsAt !== undefined) fields.endAt = endsAt;

  const status = blank(row.status)?.toLowerCase();
  return {
    code,
    fields,
    minimumCents,
    switchOn: status !== undefined && SWITCHED_ON.has(status),
    notes,
  };
}

/** The discount's rules with the minimum spend replaced, every other rule kept. */
function withMinimum(existing: unknown, minimumCents: number): Condition[] {
  const kept = Array.isArray(existing)
    ? (existing as Condition[]).filter((condition) => condition.kind !== 'min_subtotal_cents')
    : [];
  return [...kept, { kind: 'min_subtotal_cents', value: minimumCents }];
}

async function findByCode(ctx: ProcessorContext, code: string): Promise<ExistingDiscount | null> {
  return withTenant(ctx, (tx) =>
    tx.discount.findFirst({
      where: { tenantId: ctx.tenantId, code, deletedAt: null },
      select: { id: true, status: true, type: true, conditions: true },
    })
  );
}

export const discountsProcessor: EntityProcessor = {
  entity: 'discounts',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    return eachRow<RowResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const code = blank(row.code)?.toUpperCase();
        const existing = code === undefined ? null : await findByCode(ctx, code);
        const read = readDiscountRow(row, existing);
        if ('error' in read) {
          return {
            rowIndex,
            status: 'error',
            ...(code === undefined ? {} : { naturalKey: code }),
            errorMsg: read.error,
          };
        }

        const note = read.notes.length > 0 ? { errorMsg: read.notes.join(' ') } : {};

        if (existing !== null) {
          if (!options.upsert) return { rowIndex, status: 'skipped', naturalKey: read.code };
          await discountService.updateDiscount(ctx, existing.id, {
            ...read.fields,
            ...(read.minimumCents === undefined
              ? {}
              : { conditions: withMinimum(existing.conditions, read.minimumCents) }),
          });
          if (read.switchOn && existing.status !== 'active') {
            await discountService.activateDiscount(ctx, existing.id);
          }
          return { rowIndex, status: 'updated', naturalKey: read.code, ...note };
        }

        const { id } = await discountService.createDiscount(ctx, {
          ...read.fields,
          code: read.code,
          ...(read.minimumCents === undefined
            ? {}
            : { conditions: withMinimum([], read.minimumCents) }),
          ...(ctx.propertyId == null ? {} : { propertyIds: [ctx.propertyId] }),
        });
        if (read.switchOn) await discountService.activateDiscount(ctx, id);
        return { rowIndex, status: 'imported', naturalKey: read.code, ...note };
      },
      (rowIndex, message) => ({ rowIndex, status: 'error', errorMsg: message })
    );
  },

  async preview(ctx, rows, logger) {
    return eachRow<PreviewResult>(
      rows,
      logger,
      async (row, rowIndex) => {
        const code = blank(row.code)?.toUpperCase();
        const existing = code === undefined ? null : await findByCode(ctx, code);
        const read = readDiscountRow(row, existing);
        if ('error' in read) {
          return {
            rowIndex,
            action: 'error',
            ...(code === undefined ? {} : { naturalKey: code }),
            errorMsg: read.error,
          };
        }
        return {
          rowIndex,
          action: existing === null ? 'create' : 'update',
          naturalKey: read.code,
          ...(read.notes.length > 0 ? { errorMsg: read.notes.join(' ') } : {}),
        };
      },
      (rowIndex, message) => ({ rowIndex, action: 'error', errorMsg: message })
    );
  },
};
