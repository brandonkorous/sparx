// Sales slice — quotes (commerce-gated) and deals (crm-gated).
//
// These fill the Quotes surface + the CRM pipeline kanban, which otherwise sit
// empty on a fresh tenant (exactly the confusion sample data exists to prevent).
// Both link real persona customers — the cross-module story: a deal/quote names a
// customer who also has orders + a CRM profile. Deals need a pipeline + stages
// (CRM activation / the industry starter seed them); if none exist yet, deals are
// skipped rather than inventing a pipeline.

import { SAMPLE_QUOTE_PREFIX, withSampleMeta } from '../markers';

import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo, round2 } from './context';

const TAX_RATE = 0.0825;

// Quote lifecycle template — a spread across the funnel.
const QUOTE_GENS: { status: string; daysAgo: number; lineCount: number }[] = [
  { status: 'accepted', daysAgo: 20, lineCount: 3 },
  { status: 'submitted', daysAgo: 6, lineCount: 2 },
  { status: 'draft', daysAgo: 2, lineCount: 2 },
  { status: 'declined', daysAgo: 30, lineCount: 1 },
];

export async function applyQuotes(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  const { tx, tenantId } = ctx;
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
        sku: v.sku,
        name: v.title ? `${v.productTitle} — ${v.title}` : v.productTitle,
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

    await tx.quote.create({
      data: {
        tenantId,
        customerId,
        quoteNumber: `${SAMPLE_QUOTE_PREFIX}${String(1001 + i)}`,
        status: gen.status,
        subtotal,
        taxTotal,
        total,
        currency: 'USD',
        paymentTerms: 'net30',
        validUntil: daysAgo(ctx, gen.daysAgo - 30),
        ...(gen.status !== 'draft' ? { submittedAt: createdAt } : {}),
        ...(gen.status === 'accepted' ? { acceptedAt: daysAgo(ctx, gen.daysAgo - 2) } : {}),
        ...(gen.status === 'declined'
          ? {
              declinedAt: daysAgo(ctx, gen.daysAgo - 3),
              declinedReason: 'Went with an existing supplier this cycle.',
            }
          : {}),
        metadata: withSampleMeta(),
        createdAt,
        items: {
          create: lines.map((l) => ({
            tenantId,
            productId: l.productId,
            variantId: l.variantId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineSubtotal: l.lineSubtotal,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
    ctx.counts.quotes += 1;
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
