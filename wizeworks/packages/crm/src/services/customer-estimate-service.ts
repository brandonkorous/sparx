// customerEstimateService — ensures the system `customer-estimates`
// BillingDocument workflow.
//
// The direct-customer (non-B2B) counterpart to b2bQuoteService: a signed-in
// storefront customer requests an estimate, the merchant prices it, the
// customer approves or declines. Mirrors ensureB2bQuoteWorkflow's
// lazy-ensure-by-slug pattern exactly, gated on the `invoicing` module.

import {
  CUSTOMER_ESTIMATE_WORKFLOW,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
} from '@wizeworks/crm-schemas/builtins';
import { withTenant } from '@wizeworks/db';
import type { DocumentStage, DocumentWorkflow, Prisma } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

export { CUSTOMER_ESTIMATE_WORKFLOW_SLUG };

/** Eagerly seed the customer-estimates workflow on `invoicing` module
 *  activation — `ensureCustomerEstimateWorkflow` below is still the
 *  self-healing fallback every estimate-creation path calls regardless. */
export async function bootstrapCustomerEstimateWorkflow(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, (tx) => ensureCustomerEstimateWorkflow(tx, ctx.tenantId));
}

/** Resolve the tenant's system `customer-estimates` workflow, creating it
 *  (with its Requested/Priced/Approved/Declined stages) on first use.
 *  Idempotent by slug — safe under concurrent callers. Runs inside the
 *  caller's transaction. */
export async function ensureCustomerEstimateWorkflow(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<DocumentWorkflow> {
  const existing = await tx.documentWorkflow.findUnique({
    where: { tenantId_slug: { tenantId, slug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG } },
  });
  if (existing) return existing;

  return tx.documentWorkflow
    .create({
      data: {
        tenantId,
        name: CUSTOMER_ESTIMATE_WORKFLOW.name,
        slug: CUSTOMER_ESTIMATE_WORKFLOW.slug,
        isDefault: false,
        sortOrder: CUSTOMER_ESTIMATE_WORKFLOW.sortOrder,
        stages: {
          create: CUSTOMER_ESTIMATE_WORKFLOW.stages.map((s) => ({
            tenantId,
            name: s.name,
            customerLabel: s.customerLabel,
            stageType: s.stageType,
            snapshotOnEnter: s.snapshotOnEnter,
            numberOnEnter: s.numberOnEnter,
            numberPrefix: s.numberPrefix ?? null,
            locksEditing: s.locksEditing,
            color: s.color ?? null,
            sortOrder: s.sortOrder,
          })),
        },
      },
    })
    .catch(async (err: unknown) => {
      // Lost the unique(tenantId, slug) race — re-read the winner.
      if (isUniqueViolation(err)) {
        const winner = await tx.documentWorkflow.findUnique({
          where: { tenantId_slug: { tenantId, slug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG } },
        });
        if (winner) return winner;
      }
      throw err;
    });
}

/** The workflow's Requested stage — where a new estimate request starts
 *  (numbered "EST-…" on entry). Throws if a tenant hand-edited the system
 *  workflow's stages away entirely. */
export async function customerEstimateRequestedStage(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<DocumentStage> {
  const workflow = await ensureCustomerEstimateWorkflow(tx, tenantId);
  const stage = await tx.documentStage.findFirst({
    where: { workflowId: workflow.id, stageType: 'draft' },
    orderBy: { sortOrder: 'asc' },
  });
  if (!stage) throw new CrmNotFoundError('DocumentStage', CUSTOMER_ESTIMATE_WORKFLOW_SLUG);
  return stage;
}

/** A specific named stage in the tenant's customer-estimates workflow (e.g.
 *  "Approved", "Declined") — used by lifecycle actions that move an estimate
 *  directly to a known system stage. Throws if a tenant renamed/removed it. */
export async function customerEstimateStageByName(
  tx: Prisma.TransactionClient,
  tenantId: string,
  name: string
): Promise<DocumentStage> {
  const workflow = await ensureCustomerEstimateWorkflow(tx, tenantId);
  const stage = await tx.documentStage.findFirst({ where: { workflowId: workflow.id, name } });
  if (!stage)
    throw new CrmNotFoundError('DocumentStage', `${CUSTOMER_ESTIMATE_WORKFLOW_SLUG}:${name}`);
  return stage;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
