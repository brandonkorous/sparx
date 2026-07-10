// b2bQuoteService — ensures the system `b2b-quotes` BillingDocument workflow.
//
// Quotes are BillingDocuments (the Quote/QuoteItem model consolidation) on
// this system workflow. Mirrors ensureNetTermsArWorkflow's lazy-ensure-by-slug
// pattern exactly (b2b-ar-service.ts) — gated on the `b2b` module, not
// `invoicing` (billing_documents is a shared substrate; see that file's
// MODULE OWNERSHIP note for the full rationale).

import { B2B_QUOTE_WORKFLOW, B2B_QUOTE_WORKFLOW_SLUG } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { DocumentStage, DocumentWorkflow, Prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

export { B2B_QUOTE_WORKFLOW_SLUG };

/** Eagerly seed the b2b-quotes workflow on `b2b` module activation (a tenant
 *  should see + be able to customize it immediately, unlike the hidden
 *  net-terms-ar substrate) — `ensureB2bQuoteWorkflow` below is still the
 *  self-healing fallback every quote-creation path calls regardless. */
export async function bootstrapB2bQuoteWorkflow(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, (tx) => ensureB2bQuoteWorkflow(tx, ctx.tenantId));
}

/** Resolve the tenant's system `b2b-quotes` workflow, creating it (with its
 *  Draft/Submitted/Under Review/Quoted/Accepted/Declined/Expired stages) on
 *  first use. Idempotent by slug — safe under concurrent callers (a duplicate
 *  create loses the unique race and is re-read). Runs inside the caller's
 *  transaction. */
export async function ensureB2bQuoteWorkflow(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<DocumentWorkflow> {
  const existing = await tx.documentWorkflow.findUnique({
    where: { tenantId_slug: { tenantId, slug: B2B_QUOTE_WORKFLOW_SLUG } },
  });
  if (existing) return existing;

  return tx.documentWorkflow
    .create({
      data: {
        tenantId,
        name: B2B_QUOTE_WORKFLOW.name,
        slug: B2B_QUOTE_WORKFLOW.slug,
        isDefault: false,
        sortOrder: B2B_QUOTE_WORKFLOW.sortOrder,
        stages: {
          create: B2B_QUOTE_WORKFLOW.stages.map((s) => ({
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
          where: { tenantId_slug: { tenantId, slug: B2B_QUOTE_WORKFLOW_SLUG } },
        });
        if (winner) return winner;
      }
      throw err;
    });
}

/** The workflow's Draft stage — where a new quote starts (numbered "Q-…" on
 *  entry, matching the retired Quote model's numbering). Throws if a tenant
 *  hand-edited the system workflow's stages away entirely. */
export async function b2bQuoteDraftStage(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<DocumentStage> {
  const workflow = await ensureB2bQuoteWorkflow(tx, tenantId);
  const stage = await tx.documentStage.findFirst({
    where: { workflowId: workflow.id, stageType: 'draft' },
    orderBy: { sortOrder: 'asc' },
  });
  if (!stage) throw new CrmNotFoundError('DocumentStage', B2B_QUOTE_WORKFLOW_SLUG);
  return stage;
}

/** A specific named stage in the tenant's b2b-quotes workflow (e.g. "Submitted",
 *  "Accepted", "Declined") — used by lifecycle actions (both the dashboard and
 *  the customer portal) that move a quote directly to a known system stage.
 *  Throws if a tenant renamed/removed the stage. */
export async function b2bQuoteStageByName(
  tx: Prisma.TransactionClient,
  tenantId: string,
  name: string
): Promise<DocumentStage> {
  const workflow = await ensureB2bQuoteWorkflow(tx, tenantId);
  const stage = await tx.documentStage.findFirst({ where: { workflowId: workflow.id, name } });
  if (!stage) throw new CrmNotFoundError('DocumentStage', `${B2B_QUOTE_WORKFLOW_SLUG}:${name}`);
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
