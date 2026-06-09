// B2B account row processor for CSV/Excel import.
//
// Natural key: company_name. Upsert semantics:
//   - Row matches an existing company_name → update fields.
//   - No match → create new B2B account.
//
// Required columns: company_name (for creating; also the natural key).
//
// Column aliases (case-insensitive):
//   company_name, tax_id, website, pricing_tier, credit_limit,
//   payment_terms, discount_percent, status, notes, tags

import type { Logger } from 'pino';
import { b2bAccountService } from '@sparx/crm';
import { withTenant } from '@sparx/db';

export interface B2bAccountRow {
  company_name?: string;
  tax_id?: string;
  website?: string;
  pricing_tier?: string;
  credit_limit?: string;
  payment_terms?: string;
  discount_percent?: string;
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

function normalizeStatus(
  val: string | undefined
): 'active' | 'credit_hold' | 'suspended' | 'inactive' {
  if (val === 'credit_hold') return 'credit_hold';
  if (val === 'suspended') return 'suspended';
  if (val === 'inactive') return 'inactive';
  return 'active';
}

function normalizePaymentTerms(
  val: string | undefined
): 'prepay' | 'net30' | 'net60' | 'net90' | null {
  if (val === 'prepay' || val === 'net30' || val === 'net60' || val === 'net90') return val;
  return null;
}

function parseDecimal(val: string | undefined): number | undefined {
  if (!val || val.trim() === '') return undefined;
  const n = parseFloat(val.replace(/[$,%]/g, ''));
  return isNaN(n) ? undefined : n;
}

export async function processB2bAccountRows(
  ctx: { tenantId: string },
  rows: B2bAccountRow[],
  opts: { upsert: boolean },
  logger: Logger
): Promise<RowResult[]> {
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const companyName = row.company_name?.trim();
    const log = logger.child({ rowIndex: i, companyName });

    if (!companyName) {
      results.push({
        rowIndex: i,
        status: 'error',
        errorMsg: 'company_name is required',
      });
      continue;
    }

    try {
      const existing = await withTenant(ctx, (tx) =>
        tx.b2BAccount.findFirst({
          where: { tenantId: ctx.tenantId, companyName, deletedAt: null },
          select: { id: true },
        })
      );

      const creditLimit = parseDecimal(row.credit_limit);
      const discountPercent = parseDecimal(row.discount_percent);
      const tags = row.tags
        ? row.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      if (existing && opts.upsert) {
        await b2bAccountService.update(ctx, existing.id, {
          companyName,
          ...(row.tax_id !== undefined ? { taxId: row.tax_id.trim() || null } : {}),
          ...(row.website !== undefined ? { website: row.website.trim() || null } : {}),
          ...(row.pricing_tier !== undefined
            ? { pricingTier: row.pricing_tier.trim() || null }
            : {}),
          ...(creditLimit !== undefined ? { creditLimit } : {}),
          ...(row.payment_terms !== undefined
            ? { paymentTerms: normalizePaymentTerms(row.payment_terms) }
            : {}),
          ...(discountPercent !== undefined ? { discountPercent } : {}),
          ...(row.status ? { status: normalizeStatus(row.status) } : {}),
          ...(row.notes !== undefined ? { notes: row.notes.trim() || null } : {}),
          ...(tags !== undefined ? { tags } : {}),
        });
        results.push({ rowIndex: i, status: 'updated', naturalKey: companyName });
        log.debug('updated');
      } else if (existing && !opts.upsert) {
        results.push({ rowIndex: i, status: 'skipped', naturalKey: companyName });
        log.debug('skipped (upsert off)');
      } else {
        await b2bAccountService.create(ctx, {
          companyName,
          taxId: row.tax_id?.trim() || null,
          website: row.website?.trim() || null,
          pricingTier: row.pricing_tier?.trim() || null,
          creditLimit: creditLimit ?? 0,
          paymentTerms: normalizePaymentTerms(row.payment_terms),
          discountPercent: discountPercent ?? 0,
          status: normalizeStatus(row.status),
          notes: row.notes?.trim() || null,
          tags: tags ?? [],
        });
        results.push({ rowIndex: i, status: 'imported', naturalKey: companyName });
        log.debug('imported');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err }, 'row error');
      results.push({ rowIndex: i, status: 'error', naturalKey: companyName, errorMsg: msg });
    }
  }

  return results;
}
