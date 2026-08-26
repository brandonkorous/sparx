'use client';

// The editable shape of a discount, and the two conversions either side of it:
// a saved discount into a draft, and a draft into what the server accepts.
//
// Conditions are the awkward part. The editor builds the simple ones by hand
// and carries the rest through untouched, so editing a minimum spend can never
// silently delete a targeting rule set somewhere else.

import type { DiscountCondition, DiscountInput, DiscountType } from './discounts-data';
import { parseDiscountInput, type Discount } from './discounts-data';

export const CREATABLE_TYPES: DiscountType[] = ['percent', 'fixed', 'free_shipping'];

export const TYPE_LABELS: Record<DiscountType, string> = {
  percent: 'A percentage off',
  fixed: 'An amount off',
  free_shipping: 'Free delivery',
  buy_x_get_y: 'Buy one, get one',
  bundle: 'A bundle price',
};

export function centsToDollars(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

export function dollarsToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function localInputToIso(local: string): string | undefined {
  if (local.trim() === '') return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export interface Draft {
  name: string;
  description: string;
  hasCode: boolean;
  code: string;
  type: DiscountType;
  percentValue: string;
  amountDollars: string;
  minSpendDollars: string;
  minItems: string;
  firstOrderOnly: boolean;
  /** Groups of products the offer covers. EMPTY = the whole shop. */
  collectionIds: string[];
  startLocal: string;
  endLocal: string;
  totalUsageLimit: string;
  perCustomerLimit: string;
  combine: boolean;
  /** Conditions this editor does not build (per-product targeting, segments,
   *  buy-x-get-y). Carried whole so editing here never deletes them. */
  preservedConditions: DiscountCondition[];
  /** Preserved so a scope set elsewhere survives a save from here. */
  scope: Discount['scope'];
  priority: number;
  /** The sites this offer runs on. EMPTY = all of them. */
  propertyIds: string[];
}

/** Condition kinds this editor OWNS: it rebuilds them from the draft on every
 *  save, so they must be dropped from `preservedConditions` or they double up. */
const OWNED_KINDS = new Set([
  'min_subtotal_cents',
  'min_item_count',
  'first_order_only',
  'collection_in',
]);

function conditionValue(
  conditions: DiscountCondition[],
  kind: 'min_subtotal_cents' | 'min_item_count'
): number | undefined {
  const found = conditions.find((c) => c.kind === kind);
  return found && 'value' in found && typeof found.value === 'number' ? found.value : undefined;
}

function collectionIdsFrom(conditions: DiscountCondition[]): string[] {
  const found = conditions.find((c) => c.kind === 'collection_in');
  return found && 'value' in found && Array.isArray(found.value) ? [...found.value].sort() : [];
}

export function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    hasCode: true,
    code: '',
    type: 'percent',
    percentValue: '',
    amountDollars: '',
    minSpendDollars: '',
    minItems: '',
    firstOrderOnly: false,
    collectionIds: [],
    startLocal: '',
    endLocal: '',
    totalUsageLimit: '',
    perCustomerLimit: '1',
    combine: false,
    preservedConditions: [],
    scope: 'order',
    priority: 0,
    propertyIds: [],
  };
}

export function toDraft(discount: Discount): Draft {
  const minSpend = conditionValue(discount.conditions, 'min_subtotal_cents');
  const minItems = conditionValue(discount.conditions, 'min_item_count');
  return {
    name: discount.name,
    description: discount.description ?? '',
    hasCode: discount.code !== null,
    code: discount.code ?? '',
    type: discount.type,
    percentValue: discount.valuePercent === null ? '' : String(discount.valuePercent),
    amountDollars: centsToDollars(discount.valueCents),
    minSpendDollars: centsToDollars(minSpend),
    minItems: minItems === undefined ? '' : String(minItems),
    firstOrderOnly: discount.conditions.some((c) => c.kind === 'first_order_only'),
    collectionIds: collectionIdsFrom(discount.conditions),
    startLocal: isoToLocalInput(discount.startAt),
    endLocal: isoToLocalInput(discount.endAt),
    totalUsageLimit: discount.totalUsageLimit === null ? '' : String(discount.totalUsageLimit),
    perCustomerLimit: String(discount.perCustomerLimit),
    combine: discount.stacking !== 'none',
    preservedConditions: discount.conditions.filter((c) => !OWNED_KINDS.has(c.kind)),
    scope: discount.scope,
    priority: discount.priority,
    // Sorted so the dirty check (a JSON compare) can't fire on ordering alone.
    propertyIds: [...discount.propertyIds].sort(),
  };
}

/** The draft as the server's input, or null when it fails the shared schema. */
export function buildDiscountInput(draft: Draft): DiscountInput | null {
  const conditions: DiscountCondition[] = [...draft.preservedConditions];

  const minSpend = dollarsToCents(draft.minSpendDollars);
  if (minSpend !== undefined && minSpend > 0) {
    conditions.push({ kind: 'min_subtotal_cents', value: minSpend });
  }
  const minItems = Number(draft.minItems);
  if (draft.minItems.trim() !== '' && Number.isInteger(minItems) && minItems > 0) {
    conditions.push({ kind: 'min_item_count', value: minItems });
  }
  if (draft.firstOrderOnly) {
    conditions.push({ kind: 'first_order_only', value: true });
  }
  if (draft.collectionIds.length > 0) {
    conditions.push({ kind: 'collection_in', value: draft.collectionIds });
  }

  const totalLimit = Number(draft.totalUsageLimit);
  const perCustomer = Number(draft.perCustomerLimit);

  const candidate: DiscountInput = {
    name: draft.name.trim(),
    code: draft.hasCode ? draft.code.trim().toUpperCase() : null,
    description: draft.description.trim() === '' ? undefined : draft.description.trim(),
    type: draft.type,
    // A collection-limited offer IS collection-scoped. Saying so keeps the
    // stored record honest for anything reading `scope` rather than conditions.
    scope: draft.collectionIds.length > 0 ? 'collection' : draft.scope,
    ...(draft.type === 'percent' ? { valuePercent: Number(draft.percentValue) } : {}),
    ...(draft.type === 'fixed' ? { valueCents: dollarsToCents(draft.amountDollars) } : {}),
    conditions,
    ...(localInputToIso(draft.startLocal) ? { startAt: localInputToIso(draft.startLocal) } : {}),
    ...(localInputToIso(draft.endLocal) ? { endAt: localInputToIso(draft.endLocal) } : {}),
    ...(draft.totalUsageLimit.trim() !== '' && Number.isInteger(totalLimit) && totalLimit > 0
      ? { totalUsageLimit: totalLimit }
      : {}),
    perCustomerLimit: Number.isInteger(perCustomer) && perCustomer > 0 ? perCustomer : 1,
    stacking: draft.combine ? 'combine_with_all' : 'none',
    priority: draft.priority,
    propertyIds: draft.propertyIds,
  };

  const parsed = parseDiscountInput(candidate);
  return parsed.ok ? parsed.value : null;
}

export interface FieldErrors {
  name: string | null;
  code: string | null;
  percent: string | null;
  amount: string | null;
}

/** What is not filled in, in the owner's words — once, for both the fields that
 *  show it and the Save button that refuses on it. */
export function fieldErrors(draft: Draft): FieldErrors {
  return {
    name: draft.name.trim() === '' ? 'Give the discount a name.' : null,
    code: draft.hasCode && draft.code.trim() === '' ? 'Enter the code shoppers will type.' : null,
    percent:
      draft.type === 'percent' &&
      (draft.percentValue.trim() === '' || Number(draft.percentValue) <= 0)
        ? 'Enter how many percent to take off.'
        : null,
    amount:
      draft.type === 'fixed' && dollarsToCents(draft.amountDollars) === undefined
        ? 'Enter the amount to take off.'
        : null,
  };
}
