// Sample-data seam (Wave 5) — the production "Load sample data" / "Clear sample
// data" path. Thin: it reads the tenant's chosen industry + enabled modules, then
// delegates to the engine in @wizeworks/db (the SAME implementation the dev/e2e seed
// uses) and writes an audit row. The engine enforces the invariants — it never
// flips a module flag, and provisions only into the modules listed here.

import { listEnabledModules } from '@wizeworks/auth';
import type { Prisma } from '@wizeworks/db';
import {
  clearSampleData,
  loadSampleData,
  prisma,
  resolveSamplePack,
  sampleDataStatus,
  withTenant,
  type SampleDataCounts,
  type SampleDataStatus,
  type TenantContext,
} from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';

/** The tenant's chosen industry slug, or null. Reads the non-RLS `tenants` row. */
function readIndustry(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const value = (settings as Record<string, unknown>).industry;
  return typeof value === 'string' ? value : null;
}

async function tenantIndustry(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return readIndustry(tenant?.settings);
}

async function writeAudit(
  ctx: TenantContext,
  action: string,
  after: Record<string, unknown>
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action,
        entityType: 'Tenant',
        entityId: ctx.tenantId,
        diff: { after } as Prisma.InputJsonObject,
      },
    })
  );
}

/** The tenant's sample-data status: which industry pack applies, what's loaded,
 *  and the per-entity counts. */
export async function getSampleDataStatus(ctx: TenantContext): Promise<SampleDataStatus> {
  const [industry, enabled] = await Promise.all([
    tenantIndustry(ctx.tenantId),
    listEnabledModules(ctx.tenantId),
  ]);
  return sampleDataStatus(ctx, industry, enabled);
}

export interface LoadSampleDataResult {
  pack: string;
  counts: SampleDataCounts;
}

/** Load the industry pack into the tenant (idempotent — clears prior sample rows
 *  first). 404 if no pack exists for the tenant's industry. */
export async function loadTenantSampleData(ctx: TenantContext): Promise<LoadSampleDataResult> {
  const [industry, enabled] = await Promise.all([
    tenantIndustry(ctx.tenantId),
    listEnabledModules(ctx.tenantId),
  ]);
  const pack = resolveSamplePack(industry);
  if (!pack) throw notFound('SampleDataPack', industry ?? 'generic');
  const counts = await loadSampleData(ctx, pack, enabled);
  await writeAudit(ctx, 'tenant.sample_data.loaded', { industry: pack.industry, counts });
  return { pack: pack.industry, counts };
}

/** Remove every sample row for the tenant. Returns the counts removed. */
export async function clearTenantSampleData(ctx: TenantContext): Promise<SampleDataCounts> {
  const counts = await clearSampleData(ctx);
  await writeAudit(ctx, 'tenant.sample_data.cleared', { counts });
  return counts;
}
