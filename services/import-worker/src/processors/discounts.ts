// Discount row processor for CSV/Excel import.
//
// Natural key: code (discount code). Automatic discounts (no code) are created
// but cannot be upserted by code — they get a new row each import.
//
// Required columns: name. type defaults to 'percent' if omitted.
//
// Column aliases (case-insensitive):
//   code, name, description, type, scope, value_cents, value_percent, currency,
//   status, start_at, end_at, total_usage_limit, per_customer_limit

import type { Logger } from 'pino';
import { discountService } from '@sparx/commerce';
import { withTenant } from '@sparx/db';

export interface DiscountRow {
  code?: string;
  name?: string;
  description?: string;
  type?: string;
  scope?: string;
  value_cents?: string;
  value_percent?: string;
  currency?: string;
  status?: string;
  start_at?: string;
  end_at?: string;
  total_usage_limit?: string;
  per_customer_limit?: string;
  [key: string]: string | undefined;
}

export interface RowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string;
  errorMsg?: string;
}

// Trim a CSV cell; a blank/whitespace-only cell becomes undefined so it falls
// to the column default rather than persisting an empty string.
function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;
  return trimmed;
}

type DiscountType = 'percent' | 'fixed' | 'free_shipping' | 'buy_x_get_y' | 'bundle';
type DiscountScope = 'order' | 'product' | 'collection' | 'shipping';

function normalizeType(val: string | undefined): DiscountType {
  const valid: DiscountType[] = ['percent', 'fixed', 'free_shipping', 'buy_x_get_y', 'bundle'];
  return valid.includes(val as DiscountType) ? (val as DiscountType) : 'percent';
}

function normalizeScope(val: string | undefined): DiscountScope {
  const valid: DiscountScope[] = ['order', 'product', 'collection', 'shipping'];
  return valid.includes(val as DiscountScope) ? (val as DiscountScope) : 'order';
}

function parseCents(val: string | undefined): number | undefined {
  if (!val || val.trim() === '') return undefined;
  const n = Math.round(parseFloat(val.replace(/[$,]/g, '')) * 100);
  return isNaN(n) ? undefined : n;
}

function parseNum(val: string | undefined): number | undefined {
  if (!val || val.trim() === '') return undefined;
  const n = parseFloat(val.replace(/[%,]/g, ''));
  return isNaN(n) ? undefined : n;
}

function parseInt10(val: string | undefined): number | undefined {
  if (!val || val.trim() === '') return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

export async function processDiscountRows(
  ctx: { tenantId: string },
  rows: DiscountRow[],
  opts: { upsert: boolean },
  logger: Logger
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const code = blank(row.code)?.toUpperCase();
    const naturalKey = code ?? `row-${i + 1}`;
    const log = logger.child({ rowIndex: i, code });

    if (!row.name?.trim()) {
      results.push({ rowIndex: i, status: 'error', naturalKey, errorMsg: 'name is required' });
      continue;
    }

    try {
      const existing = code
        ? await withTenant(ctx, (tx) =>
            tx.discount.findFirst({
              where: { tenantId: ctx.tenantId, code, deletedAt: null },
              select: { id: true, status: true },
            })
          )
        : null;

      const base = {
        name: row.name.trim(),
        description: blank(row.description),
        type: normalizeType(row.type),
        scope: normalizeScope(row.scope),
        valueCents: parseCents(row.value_cents),
        valuePercent: parseNum(row.value_percent),
        currency: blank(row.currency)?.toUpperCase(),
        startAt: blank(row.start_at),
        endAt: blank(row.end_at),
        totalUsageLimit: parseInt10(row.total_usage_limit),
        perCustomerLimit: parseInt10(row.per_customer_limit) ?? 1,
      };

      if (existing && opts.upsert) {
        await discountService.updateDiscount(ctx, existing.id, base);
        if (row.status === 'active' && existing.status !== 'active') {
          await discountService.activateDiscount(ctx, existing.id);
        } else if (row.status === 'archived' && existing.status !== 'archived') {
          await discountService.archiveDiscount(ctx, existing.id);
        }
        results.push({ rowIndex: i, status: 'updated', naturalKey });
        log.debug('updated');
      } else if (existing && !opts.upsert) {
        results.push({ rowIndex: i, status: 'skipped', naturalKey });
        log.debug('skipped (upsert off)');
      } else {
        const { id } = await discountService.createDiscount(ctx, { ...base, code: code ?? null });
        if (row.status === 'active') {
          await discountService.activateDiscount(ctx, id);
        }
        results.push({ rowIndex: i, status: 'imported', naturalKey });
        log.debug('imported');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey, errorMsg: msg });
    }
  }

  return results;
}
