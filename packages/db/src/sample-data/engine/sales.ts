// Sales slice — quotes (b2b-gated) and deals (crm-gated).
//
// These fill the Quotes surface + the CRM pipeline kanban, which otherwise sit
// empty on a fresh tenant (exactly the confusion sample data exists to prevent).
// Both link real persona customers — the cross-module story: a deal/quote names a
// customer who also has orders + a CRM profile. Quotes are BillingDocuments on the
// system b2b-quotes workflow (seeded on `b2b` module activation —
// module-provisioning.ts); if it doesn't exist yet (a pre-existing tenant that
// hasn't re-activated), quotes are skipped rather than inventing the workflow —
// same convention as applyDeals skipping without a pipeline. Deals need a pipeline
// + stages (CRM activation / the industry starter seed them); if none exist yet,
// deals are skipped rather than inventing a pipeline.

import { withSampleMeta } from '../markers';

import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo, round2 } from './context';

const TAX_RATE = 0.0825;
const B2B_QUOTES_WORKFLOW_SLUG = 'b2b-quotes';
// Sample document numbers live in a high sequence range so they never collide with
// a tenant's own Q- numbering (which starts at 1); Clear removes them regardless.
const SAMPLE_SEQ_BASE = 9101;

// Quote lifecycle template — a spread across the funnel, keyed by the system
// workflow's stage NAME (not the retired Quote model's status enum).
const QUOTE_GENS: { stageName: string; daysAgo: number; lineCount: number }[] = [
  { stageName: 'Accepted', daysAgo: 20, lineCount: 3 },
  { stageName: 'Submitted', daysAgo: 6, lineCount: 2 },
  { stageName: 'Draft', daysAgo: 2, lineCount: 2 },
  { stageName: 'Declined', daysAgo: 30, lineCount: 1 },
];

export async function applyQuotes(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('b2b')) return;
  const { tx, tenantId } = ctx;

  const workflow = await tx.documentWorkflow.findUnique({
    where: { tenantId_slug: { tenantId, slug: B2B_QUOTES_WORKFLOW_SLUG } },
    include: { stages: true },
  });
  if (!workflow) return;
  const stageByName = new Map(workflow.stages.map((s) => [s.name, s]));

  // Prefer B2B personas for quotes (wholesale buyers), else any persona.
  const personas = pack.personas.filter((p) => p.kind === 'b2b').length
    ? pack.personas.filter((p) => p.kind === 'b2b')
    : pack.personas;
  const customerIds = personas
    .map((p) => ctx.customerIdByPersona.get(p.key))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0 || ctx.variantOrder.length === 0) return;

  for (let i = 0; i < QUOTE_GENS.length; i++) {
    const gen = QUOTE_GENS[i]!;
    const stage = stageByName.get(gen.stageName);
    if (!stage) continue; // a tenant renamed/removed the system stage
    const customerId = customerIds[i % customerIds.length]!;
    const createdAt = daysAgo(ctx, gen.daysAgo);
    const lines = Array.from({ length: gen.lineCount }, (_, j) => {
      const v = ctx.variantsByKey.get(ctx.variantOrder[(i + j) % ctx.variantOrder.length]!)!;
      const quantity = (j + 1) * 4; // wholesale-ish quantities
      const unitPrice = round2(v.priceCents / 100);
      const lineSubtotal = round2(unitPrice * quantity);
      const taxAmount = round2(lineSubtotal * TAX_RATE);
      return {
        productId: v.productId,
        variantId: v.id,
        description: v.title ? `${v.productTitle} — ${v.title}` : v.productTitle,
        quantity,
        unitPrice,
        lineSubtotal,
        taxAmount,
        lineTotal: round2(lineSubtotal + taxAmount),
      };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
    const total = round2(subtotal + taxTotal);
    const seq = SAMPLE_SEQ_BASE + i;

    await tx.billingDocument.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        stageId: stage.id,
        customerId,
        number: `Q-${seq}`,
        numberSeq: seq,
        subtotal,
        taxTotal,
        total,
        balance: total,
        currency: 'USD',
        validUntil: daysAgo(ctx, gen.daysAgo - 30),
        ...(gen.stageName === 'Declined'
          ? { declinedReason: 'Went with an existing supplier this cycle.' }
          : {}),
        metadata: withSampleMeta(),
        createdAt,
        lines: {
          create: lines.map((l, idx) => ({
            tenantId,
            productId: l.productId,
            variantId: l.variantId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineSubtotal: l.lineSubtotal,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
            sortOrder: idx,
          })),
        },
      },
    });
    ctx.counts.billingDocuments += 1;
  }
}

// Deal generation: distribute across the pipeline's open stages, plus one won +
// one lost on those stage types when present.
const DEAL_TITLES = [
  'Initial order',
  'Repeat order — quarterly',
  'Fleet contract',
  'Expansion opportunity',
  'Renewal',
];

export async function applyDeals(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('crm')) return;
  const { tx, tenantId } = ctx;

  const pipeline = await tx.pipeline.findFirst({
    where: { archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      stages: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, stageType: true, probability: true },
      },
    },
  });
  if (!pipeline || pipeline.stages.length === 0) return;

  const personas = pack.personas;
  const customerIds = personas
    .map((p) => ctx.customerIdByPersona.get(p.key))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0) return;

  // A believable spread: cycle every stage (so the kanban has cards in each column).
  for (let i = 0; i < pipeline.stages.length; i++) {
    const stage = pipeline.stages[i]!;
    const customerId = customerIds[i % customerIds.length]!;
    const persona = personas[i % personas.length]!;
    const value = round2(2500 + i * 1800 + 999);
    const closed = stage.stageType === 'won' || stage.stageType === 'lost';
    await tx.deal.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        customerId,
        title: `${persona.company ?? persona.name} — ${DEAL_TITLES[i % DEAL_TITLES.length]!}`,
        value,
        currency: 'USD',
        probability: stage.probability,
        expectedCloseDate: daysAgo(ctx, -14 + i),
        ...(closed
          ? {
              closedAt: daysAgo(ctx, 3),
              closedReason: stage.stageType === 'won' ? 'Signed' : 'Chose another vendor',
            }
          : {}),
        source: 'sample',
        metadata: withSampleMeta(),
      },
    });
    ctx.counts.deals += 1;
  }
}
