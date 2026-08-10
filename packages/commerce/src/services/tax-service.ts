// taxService — merchant nexus configuration, exemption certificates,
// and the calculation pipeline. The TaxProvider plugin (Stripe Tax /
// TaxJar / Avalara) produces breakdowns at checkout time when installed;
// the manual fallback rates here power the calculator otherwise so a
// merchant can transact before plugging in a provider.

import {
  CreateTaxExemptionInput,
  CreateTaxRateInput,
  CreateTaxZoneInput,
  type TaxBreakdown,
  TaxCalculationRequest,
  UpdateTaxZoneInput,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TaxExemption, TaxRate, TaxZone, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ──────────────────────────────────────────────────────

export interface TaxZoneRow {
  id: string;
  country: string;
  region: string | null;
  nexusType: string;
  registrationNumber: string | null;
  registeredAt: string | null;
  isActive: boolean;
  rateCount: number;
}

export interface TaxRateRow {
  id: string;
  zoneId: string;
  name: string;
  rateBasisPoints: number;
  appliesToShipping: boolean;
  productTaxClass: string | null;
}

export interface TaxExemptionRow {
  id: string;
  customerId: string | null;
  companyId: string | null;
  jurisdiction: string;
  reason: string;
  certificateNumber: string;
  certificateMediaId: string | null;
  validFrom: string;
  validTo: string | null;
}

// ─── Zones ───────────────────────────────────────────────────────────

export async function listZones(
  ctx: ServiceContext,
  filter: { take?: number; skip?: number } = {}
): Promise<{ items: TaxZoneRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.taxZone.findMany({
        include: { _count: { select: { rates: true } } },
        orderBy: [{ country: 'asc' }, { region: 'asc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.taxZone.count(),
    ]);
    return { items: rows.map(serializeZone), total };
  });
}

export async function getZone(ctx: ServiceContext, id: string): Promise<TaxZoneRow> {
  const row = await withTenant(ctx, (tx) =>
    tx.taxZone.findFirst({
      where: { id },
      include: { _count: { select: { rates: true } } },
    })
  );
  if (!row) throw new CommerceNotFoundError('TaxZone', id);
  return serializeZone(row);
}

export async function createZone(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateTaxZoneInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const created = await tx.taxZone.create({
      data: {
        tenantId: ctx.tenantId,
        country: input.country,
        region: input.region ?? null,
        nexusType: input.nexusType,
        registrationNumber: input.registrationNumber ?? null,
        registeredAt: input.registeredAt ? new Date(input.registeredAt) : null,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_zone.created',
      entityType: 'TaxZone',
      entityId: created.id,
      diff: { after: { country: input.country, region: input.region } },
    });
    return created;
  });
}

export async function updateZone(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<void> {
  const input = UpdateTaxZoneInput.parse(rawInput);
  await withTenant(ctx, async (tx) => {
    const before = await tx.taxZone.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('TaxZone', id);
    await tx.taxZone.update({
      where: { id },
      data: {
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.region !== undefined ? { region: input.region ?? null } : {}),
        ...(input.nexusType !== undefined ? { nexusType: input.nexusType } : {}),
        ...(input.registrationNumber !== undefined
          ? { registrationNumber: input.registrationNumber ?? null }
          : {}),
        ...(input.registeredAt !== undefined
          ? { registeredAt: input.registeredAt ? new Date(input.registeredAt) : null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_zone.updated',
      entityType: 'TaxZone',
      entityId: id,
      diff: null,
    });
  });
}

export async function deleteZone(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.taxZone.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('TaxZone', id);
    await tx.taxZone.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_zone.deleted',
      entityType: 'TaxZone',
      entityId: id,
      diff: null,
    });
  });
}

// ─── Manual fallback rates ───────────────────────────────────────────

export async function createRate(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateTaxRateInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    await assertZoneExists(tx, input.zoneId);
    const created = await tx.taxRate.create({
      data: {
        tenantId: ctx.tenantId,
        zoneId: input.zoneId,
        name: input.name,
        rateBasisPoints: input.rateBasisPoints,
        appliesToShipping: input.appliesToShipping,
        productTaxClass: input.productTaxClass ?? null,
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_rate.created',
      entityType: 'TaxRate',
      entityId: created.id,
      diff: {
        after: { name: input.name, rateBasisPoints: input.rateBasisPoints },
      },
    });
    return created;
  });
}

export async function listRatesForZone(ctx: ServiceContext, zoneId: string): Promise<TaxRateRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.taxRate.findMany({
      where: { zoneId },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return rows.map(serializeRate);
  });
}

export async function deleteRate(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.taxRate.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('TaxRate', id);
    await tx.taxRate.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_rate.deleted',
      entityType: 'TaxRate',
      entityId: id,
      diff: null,
    });
  });
}

// ─── Exemptions ──────────────────────────────────────────────────────

export async function createExemption(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateTaxExemptionInput.parse(rawInput);
  if (!input.customerId && !input.companyId) {
    throw new CommerceValidationError('Either customerId or companyId is required');
  }
  return withTenant(ctx, async (tx) => {
    const created = await tx.taxExemption.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: input.customerId ?? null,
        companyId: input.companyId ?? null,
        jurisdiction: input.jurisdiction,
        reason: input.reason,
        certificateNumber: input.certificateNumber,
        certificateMediaId: input.certificateMediaId ?? null,
        validFrom: new Date(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_exemption.created',
      entityType: 'TaxExemption',
      entityId: created.id,
      diff: { after: { jurisdiction: input.jurisdiction, reason: input.reason } },
    });
    return created;
  });
}

export async function listExemptionsForCustomer(
  ctx: ServiceContext,
  customerId: string
): Promise<TaxExemptionRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.taxExemption.findMany({
      where: { customerId },
      orderBy: { validFrom: 'desc' },
      take: 100,
    });
    return rows.map(serializeExemption);
  });
}

export async function listExemptionsForCompany(
  ctx: ServiceContext,
  companyId: string
): Promise<TaxExemptionRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.taxExemption.findMany({
      where: { companyId },
      orderBy: { validFrom: 'desc' },
      take: 100,
    });
    return rows.map(serializeExemption);
  });
}

export async function deleteExemption(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.taxExemption.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('TaxExemption', id);
    await tx.taxExemption.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.tax_exemption.deleted',
      entityType: 'TaxExemption',
      entityId: id,
      diff: null,
    });
  });
}

// ─── Activation default (docs/104 L2) ────────────────────────────────
//
// On `module.activated(commerce)`, seed the merchant's home nexus zone so the
// Tax surface is wired with a guided starting point instead of an empty table.
// Tax is deliberately unlike shipping: with no matching zone, `calculate()`
// already returns a $0 breakdown (you only collect where you have nexus), so a
// *live* default rate would be wrong — it would collect tax in a jurisdiction the
// merchant isn't registered for. So the seed is ONE zone for the operating
// country, **inactive and with zero rates**: `calculate()` only matches active
// zones, so not a cent of tax is charged until the merchant fills in their
// registration + rate and flips it active (or installs a TaxProvider, which
// always wins). Find-or-create by "the tenant has any tax zone" — a merchant who
// already configured tax is never touched. Country comes from the operating
// warehouse (fallback 'US', matching the other commerce defaults). `tenantId` is
// scoped explicitly (not just RLS) since the local superuser bypasses RLS
// (docs/104 R1–R4).
export async function bootstrapDefaults(ctx: ServiceContext): Promise<{ created: boolean }> {
  return withTenant(ctx, async (tx) => {
    const zoneCount = await tx.taxZone.count({ where: { tenantId: ctx.tenantId } });
    if (zoneCount > 0) return { created: false };

    const homeWarehouse = await tx.warehouse.findFirst({
      where: { tenantId: ctx.tenantId, isSystem: false, deletedAt: null },
      select: { country: true },
    });
    const country = homeWarehouse?.country ?? 'US';

    const zone = await tx.taxZone.create({
      data: {
        tenantId: ctx.tenantId,
        country,
        region: null,
        nexusType: 'physical',
        isActive: false,
      },
      select: { id: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'commerce.tax.bootstrapped',
      entityType: 'TaxZone',
      entityId: zone.id,
      diff: { after: { country, nexusType: 'physical', isActive: false } },
    });
    return { created: true };
  });
}

// ─── Calculation ─────────────────────────────────────────────────────
//
// When a TaxProvider plugin is installed it always wins. Until then,
// the manual fallback rates here drive the calculation so storefront +
// B2B checkouts can quote tax from the first onboarding session.

export async function calculate(ctx: ServiceContext, rawRequest: unknown): Promise<TaxBreakdown> {
  const request = TaxCalculationRequest.parse(rawRequest);

  // Find the most-specific matching zone (region > country) that's
  // active for this tenant + ship-to country.
  const zones = await withTenant(ctx, async (tx) => {
    return tx.taxZone.findMany({
      where: {
        isActive: true,
        country: request.shipTo.country,
      },
      include: { rates: true },
    });
  });

  const zone =
    zones.find((z) => z.region && z.region === request.shipTo.region) ??
    zones.find((z) => !z.region) ??
    null;

  // If we have no zone, the merchant has no nexus configured here —
  // return a zero breakdown so checkout can continue.
  if (!zone) {
    return emptyBreakdown(request);
  }

  const lines = request.lines.map((line, idx) => {
    const taxable = Math.max(0, line.unitPriceCents * line.quantity - line.discountAmountCents);
    const applicableRates = zone.rates.filter(
      (r) => !r.productTaxClass || r.productTaxClass === line.productTaxClass
    );
    const totalRate = applicableRates.reduce((sum, r) => sum + r.rateBasisPoints, 0);
    const taxCents = Math.round((taxable * totalRate) / 10_000);
    return {
      lineRef: idx,
      taxableAmountCents: taxable,
      taxAmountCents: taxCents,
      jurisdictions: applicableRates.map((r) => ({
        name: r.name,
        type: regionScope(zone.region) as 'state' | 'country',
        rateBasisPoints: r.rateBasisPoints,
        amountCents: Math.round((taxable * r.rateBasisPoints) / 10_000),
      })),
    };
  });

  const shippingRates = zone.rates.filter((r) => r.appliesToShipping);
  const shippingRateBp = shippingRates.reduce((s, r) => s + r.rateBasisPoints, 0);
  const shippingTaxCents = Math.round((request.shippingAmountCents * shippingRateBp) / 10_000);
  const totalTaxCents = lines.reduce((s, l) => s + l.taxAmountCents, 0) + shippingTaxCents;

  return {
    providerSlug: 'sparx-manual',
    breakdownRef: `manual:${ctx.tenantId}:${Date.now()}`,
    totalTaxCents,
    shippingTaxCents,
    lines,
    calculatedAt: new Date().toISOString(),
  };
}

/** Refund-side hook — reverses the provider transaction tied to the
 *  given breakdownRef. Manual breakdowns have nothing to reverse
 *  (no remote transaction to roll back), so the call is a no-op. */
export function reverse(
  _ctx: ServiceContext,
  input: { providerSlug: string; breakdownRef: string; orderId: string }
): Promise<void> {
  if (input.providerSlug === 'sparx-manual') return Promise.resolve();
  // Real provider reversal lands with the provider integration bridge.
  return Promise.reject(
    new CommerceValidationError(
      `No tax provider installed for slug "${input.providerSlug}"; cannot reverse breakdown.`
    )
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

async function assertZoneExists(tx: TxClient, id: string): Promise<void> {
  const row = await tx.taxZone.findFirst({ where: { id }, select: { id: true } });
  if (!row) throw new CommerceNotFoundError('TaxZone', id);
}

function regionScope(region: string | null): string {
  return region ? 'state' : 'country';
}

function emptyBreakdown(request: TaxCalculationRequest): TaxBreakdown {
  return {
    providerSlug: 'sparx-manual',
    breakdownRef: `manual:no-nexus:${Date.now()}`,
    totalTaxCents: 0,
    shippingTaxCents: 0,
    lines: request.lines.map((line, idx) => ({
      lineRef: idx,
      taxableAmountCents: Math.max(
        0,
        line.unitPriceCents * line.quantity - line.discountAmountCents
      ),
      taxAmountCents: 0,
      jurisdictions: [],
    })),
    calculatedAt: new Date().toISOString(),
  };
}

function serializeZone(row: TaxZone & { _count: { rates: number } }): TaxZoneRow {
  return {
    id: row.id,
    country: row.country,
    region: row.region,
    nexusType: row.nexusType,
    registrationNumber: row.registrationNumber,
    registeredAt: row.registeredAt?.toISOString() ?? null,
    isActive: row.isActive,
    rateCount: row._count.rates,
  };
}

function serializeRate(row: TaxRate): TaxRateRow {
  return {
    id: row.id,
    zoneId: row.zoneId,
    name: row.name,
    rateBasisPoints: row.rateBasisPoints,
    appliesToShipping: row.appliesToShipping,
    productTaxClass: row.productTaxClass,
  };
}

function serializeExemption(row: TaxExemption): TaxExemptionRow {
  return {
    id: row.id,
    customerId: row.customerId,
    companyId: row.companyId,
    jurisdiction: row.jurisdiction,
    reason: row.reason,
    certificateNumber: row.certificateNumber,
    certificateMediaId: row.certificateMediaId,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
  };
}
