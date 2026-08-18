// The platform's own funnel — the "Tenant Signups" pipeline on the WizeWorks
// tenant, one deal per sparx tenant.
//
// This is deliberately NOT a @wizeworks/crm-schemas built-in: built-ins are seeded
// into EVERY tenant on CRM activation, and no customer of ours wants a pipeline
// modelling sparx's own trials. It belongs to the one tenant that runs sparx.
//
// Stages are identified by `sortOrder`, never by name — the pipeline is a real,
// editable CRM object, and renaming a stage on the board must not break the
// mirror. Deleting one would; `resolveStages` reports that instead of guessing.

import { withTenant } from '@wizeworks/db';

import type { PlatformTarget } from './target';

/** The lifecycle positions the mirror can move a tenant's deal into. */
export type StageKey = 'trial' | 'activated' | 'paying' | 'trial_expired' | 'churned';

interface StageTemplate {
  key: StageKey;
  name: string;
  sortOrder: number;
  probability: number;
  stageType: 'open' | 'won' | 'lost';
  color: string;
}

export const PLATFORM_PIPELINE_SLUG = 'tenant-signups';
export const PLATFORM_PIPELINE_NAME = 'Tenant Signups';

// Trial → Activated → Paying is the happy path; the two lost stages are kept
// apart because they are different businesses to fix. "Trial expired" is a
// tenant we never converted (onboarding/activation problem); "Churned" is one we
// converted and then lost (retention problem). Collapsing them would hide which.
export const PLATFORM_PIPELINE_STAGES: readonly StageTemplate[] = [
  {
    key: 'trial',
    name: 'Trial',
    sortOrder: 0,
    probability: 20,
    stageType: 'open',
    color: '#94A3B8',
  },
  {
    key: 'activated',
    name: 'Activated',
    sortOrder: 1,
    probability: 45,
    stageType: 'open',
    color: '#6366F1',
  },
  {
    key: 'paying',
    name: 'Paying',
    sortOrder: 2,
    probability: 100,
    stageType: 'won',
    color: '#10B981',
  },
  {
    key: 'trial_expired',
    name: 'Trial expired',
    sortOrder: 3,
    probability: 0,
    stageType: 'lost',
    color: '#F59E0B',
  },
  {
    key: 'churned',
    name: 'Churned',
    sortOrder: 4,
    probability: 0,
    stageType: 'lost',
    color: '#EF4444',
  },
];

export interface ResolvedPipeline {
  pipelineId: string;
  /** Stage id per lifecycle key. A key is absent if a human deleted that stage. */
  stageIds: Partial<Record<StageKey, string>>;
  /** Reverse lookup — which lifecycle position a deal is sitting in right now. */
  keyByStageId: Map<string, StageKey>;
}

/** Find-or-create the platform signup pipeline. Idempotent: a redelivered event
 *  (or a second worker instance) reuses the existing pipeline rather than
 *  minting a duplicate. Runs under the platform tenant's RLS context. */
export async function ensurePlatformPipeline(target: PlatformTarget): Promise<ResolvedPipeline> {
  const propertyId = target.propertyId;

  const pipeline = await withTenant({ tenantId: target.tenantId }, async (tx) => {
    // findFirst, not findUnique: the unique is (tenant, property, slug) NULLS NOT
    // DISTINCT, which Prisma can't address through a compound key when property
    // is null (same reason bootstrapDefaultPipeline does this).
    const existing = await tx.pipeline.findFirst({
      where: { propertyId, slug: PLATFORM_PIPELINE_SLUG },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) return existing;

    return tx.pipeline.create({
      data: {
        tenantId: target.tenantId,
        propertyId,
        name: PLATFORM_PIPELINE_NAME,
        slug: PLATFORM_PIPELINE_SLUG,
        // Not the default pipeline — the platform tenant sells too, and its own
        // sales process shouldn't be displaced by this internal one.
        isDefault: false,
        stages: {
          create: PLATFORM_PIPELINE_STAGES.map((s) => ({
            tenantId: target.tenantId,
            name: s.name,
            sortOrder: s.sortOrder,
            probability: s.probability,
            stageType: s.stageType,
            color: s.color,
          })),
        },
      },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  const bySortOrder = new Map(pipeline.stages.map((s) => [s.sortOrder, s.id]));
  const stageIds: Partial<Record<StageKey, string>> = {};
  const keyByStageId = new Map<string, StageKey>();
  for (const template of PLATFORM_PIPELINE_STAGES) {
    const id = bySortOrder.get(template.sortOrder);
    if (!id) continue;
    stageIds[template.key] = id;
    keyByStageId.set(id, template.key);
  }

  return { pipelineId: pipeline.id, stageIds, keyByStageId };
}
