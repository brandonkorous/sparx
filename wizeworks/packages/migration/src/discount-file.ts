// The discount spreadsheet sparx itself writes and reads back.
//
// There are two ways a discount file arrives: the Move-in mapper, which produces the
// canonical keys in `ENTITY_FIELDS.discounts`, and the discount CSV endpoint
// (`POST /v1/commerce/discounts/import`), which takes a file straight from a tenant.
// Both land on the same processor, and that processor reads ONE set of columns: the
// canonical ones. They used to disagree. The processor read the export's own column
// names (`name`, `value_cents`, `start_at`, `total_usage_limit`), the mapper offered
// the canonical ones, and every discount a Move-in carried failed "name is required"
// with its value, dates and limit dropped.
//
// So the export now writes the canonical columns (`discountExportRow`), which makes an
// export something a tenant can drop straight back in, and a file saved from the
// OLDER export is translated on the way in (`discountRowFromFile`). The translation
// lives here, beside the contract, rather than in the processor: the processor has
// one vocabulary, and the old spelling is just one more source format.

import { toDecimal } from './coerce';
import { ENTITY_FIELDS, type CanonicalRow } from './canonical';

/** The export's columns, in order: exactly the canonical discount keys, then two
 *  read-only facts about the discount that an import has no field for. */
export const DISCOUNT_FILE_COLUMNS: readonly string[] = [
  ...ENTITY_FIELDS.discounts.map((field) => field.key),
  'times_used',
  'updated_at',
];

/** The discount as the commerce service lists it — structurally, so this package
 *  keeps its no-dependencies promise. */
export interface ExportableDiscount {
  code: string | null;
  name: string;
  description: string | null;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  currency: string | null;
  conditions: readonly { kind: string; value?: unknown }[];
  totalUsageLimit: number | null;
  perCustomerLimit: number;
  startAt: string | null;
  endAt: string | null;
  status: string;
  usageCount: number;
  updatedAt: string;
}

/** The platform's discount types in the file's spelling. */
const TYPE_TO_FILE: Record<string, string> = {
  percent: 'percentage',
  fixed: 'fixed_amount',
  free_shipping: 'free_shipping',
};

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** One discount as a row of the export. */
export function discountExportRow(discount: ExportableDiscount): Record<string, string> {
  const minimum = discount.conditions.find((condition) => condition.kind === 'min_subtotal_cents');
  const value =
    discount.type === 'percent'
      ? discount.valuePercent
      : discount.type === 'fixed' && discount.valueCents !== null
        ? discount.valueCents / 100
        : null;
  return {
    code: discount.code ?? '',
    title: discount.name,
    description: discount.description ?? '',
    // A buy-x-get-y or bundle discount is written under its own name. The import
    // refuses those by name rather than guessing, because what they give away is a
    // set of product rules a spreadsheet row does not carry.
    type: TYPE_TO_FILE[discount.type] ?? discount.type,
    value: value === null ? '' : String(value),
    currency: discount.currency ?? '',
    minimum_amount: typeof minimum?.value === 'number' ? money(minimum.value) : '',
    usage_limit: discount.totalUsageLimit === null ? '' : String(discount.totalUsageLimit),
    per_customer_limit: String(discount.perCustomerLimit),
    starts_at: discount.startAt ?? '',
    ends_at: discount.endAt ?? '',
    status: discount.status === 'active' ? 'active' : 'disabled',
    times_used: String(discount.usageCount),
    updated_at: discount.updatedAt,
  };
}

/** Old export status → the canonical vocabulary. A draft or archived discount comes
 *  back switched off, which is what both of them were. */
const OLD_STATUS: Record<string, string> = {
  active: 'active',
  draft: 'disabled',
  archived: 'disabled',
};

/** Old export type → the canonical vocabulary. Anything else passes through by name,
 *  so the processor can say which type it will not import. */
const OLD_TYPE: Record<string, string> = {
  percent: 'percentage',
  fixed: 'fixed_amount',
};

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/**
 * A row of an uploaded discount file, in canonical keys.
 *
 * A canonical column always wins; an older column only fills a canonical one the file
 * left empty. So a current export passes through untouched, a file saved from the old
 * export is read the way it was written, and a file mixing the two is read by its
 * canonical columns.
 */
export function discountRowFromFile(row: Record<string, string>): CanonicalRow {
  const out: CanonicalRow = {};
  for (const key of ENTITY_FIELDS.discounts.map((field) => field.key)) {
    const value = row[key];
    if (present(value)) out[key] = value;
  }

  const fill = (key: string, value: string | undefined): void => {
    if (!present(out[key]) && present(value)) out[key] = value.trim();
  };

  fill('title', row.name);
  fill('starts_at', row.start_at);
  fill('ends_at', row.end_at);
  fill('usage_limit', row.total_usage_limit);

  const oldType = (row.type ?? '').trim().toLowerCase();
  if (OLD_TYPE[oldType] !== undefined) out.type = OLD_TYPE[oldType];

  const oldStatus = (row.status ?? '').trim().toLowerCase();
  if (OLD_STATUS[oldStatus] !== undefined && oldStatus !== 'active') {
    out.status = OLD_STATUS[oldStatus];
  }

  // The old export split the value across two columns in two units: a percentage in
  // `value_percent`, and a fixed amount in whole CENTS in `value_cents`.
  if (!present(out.value)) {
    if (present(row.value_percent)) {
      out.value = row.value_percent.trim();
    } else if (present(row.value_cents)) {
      const cents = toDecimal(row.value_cents);
      if (cents !== undefined) out.value = money(Math.round(cents));
    }
  }

  return out;
}
