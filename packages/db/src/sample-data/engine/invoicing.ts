// Invoicing slice — authored billing documents (docs/87). Invoicing-gated.
//
// A BillingDocument is the estimate→invoice→paid AR document that backs the
// `/invoicing` surface (+ the aging report). It rides free with Commerce/B2B, so
// this surface is enabled for nearly every tenant — an empty documents list + aging
// report is exactly the confusion sample data exists to prevent.
//
// Documents attach to the tenant's default DocumentWorkflow + stages and reference
// the seeded line-type registry (both provisioned on module activation — see
// api-rest module-provisioning `provisionInvoicingDefaults`), so this reads that
// config the way `applyDeals` reads the CRM pipeline; if none exists yet it skips
// rather than inventing config. Documents bill the sample customers (retail + B2B)
// with lines drawn from sample products + labor/fee lines, spread across the AR
// lifecycle (paid → unpaid → partial → overdue → void) so every status + the aging
// buckets render. Payments back the paid/partial ones; a snapshot freezes any
// document that lands on a snapshot-on-enter stage (the "receipt").

import { withSampleMeta } from '../markers';

import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo, round2 } from './context';

const TAX_RATE = 0.0825;
const LABOR_RATE = 95; // $/hr for the labor line
// Sample document numbers live in a high sequence range so they never collide with
// a tenant's own INV- numbering (which starts at 1); Clear removes them regardless.
const SAMPLE_SEQ_BASE = 9001;

type ArStatus = 'paid' | 'unpaid' | 'partial' | 'overdue' | 'void';

interface DocSpec {
  status: ArStatus;
  createdDaysAgo: number;
  // Net-terms due date offset in days (positive = past → overdue-eligible; negative
  // = future; null = no due date). Drives the aging report.
  dueDaysAgo: number | null;
  laborHours: number;
  feeCents: number;
}

// A spread across the whole AR lifecycle so the documents list, status filters, and
// the aging report all render real data.
const DOC_SPECS: DocSpec[] = [
  { status: 'paid', createdDaysAgo: 26, dueDaysAgo: 12, laborHours: 2, feeCents: 0 },
  { status: 'unpaid', createdDaysAgo: 8, dueDaysAgo: -22, laborHours: 1.5, feeCents: 0 },
  { status: 'partial', createdDaysAgo: 15, dueDaysAgo: -5, laborHours: 3, feeCents: 2500 },
  { status: 'overdue', createdDaysAgo: 40, dueDaysAgo: 14, laborHours: 1, feeCents: 0 },
  { status: 'void', createdDaysAgo: 20, dueDaysAgo: null, laborHours: 1, feeCents: 0 },
];

interface LineInput {
  typeId: string | null;
  productId?: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}
interface LineComputed extends LineInput {
  lineSubtotal: number;
  taxAmount: number;
  lineTotal: number;
}

function computeLine(input: LineInput): LineComputed {
  const lineSubtotal = round2(input.quantity * input.unitPrice);
  const taxAmount = input.taxable ? round2(lineSubtotal * TAX_RATE) : 0;
  return { ...input, lineSubtotal, taxAmount, lineTotal: round2(lineSubtotal + taxAmount) };
}

export async function applyInvoicing(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('invoicing')) return;
  const { tx, tenantId } = ctx;

  // Config (workflow + stages + line types) is seeded on activation, not here —
  // read the default workflow like applyDeals reads the pipeline; skip if absent.
  const workflow = await tx.documentWorkflow.findFirst({
    where: { archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    include: { stages: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!workflow || workflow.stages.length === 0) return;

  const stages = workflow.stages;
  const paidStage = stages.find((s) => s.stageType === 'paid') ?? stages[stages.length - 1]!;
  const billableStage =
    stages.find((s) => s.stageType === 'open' || s.stageType === 'final') ??
    stages.find((s) => s.stageType !== 'paid') ??
    stages[0]!;
  const numberPrefix = billableStage.numberPrefix ?? paidStage.numberPrefix ?? 'INV-';

  const lineTypes = await tx.billingDocumentLineType.findMany({ select: { id: true, key: true } });
  const typeId = (key: string): string | null => lineTypes.find((t) => t.key === key)?.id ?? null;
  const catalogTypeId = typeId('catalog') ?? typeId('part');

  // Bill the sample customers (retail + B2B); company name where present for billTo.
  const billable = pack.personas
    .map((p) => ({ id: ctx.customerIdByPersona.get(p.key), name: p.company ?? p.name }))
    .filter((c): c is { id: string; name: string } => Boolean(c.id));
  if (billable.length === 0 || ctx.variantOrder.length === 0) return;

  for (let i = 0; i < DOC_SPECS.length; i++) {
    const spec = DOC_SPECS[i]!;
    const party = billable[i % billable.length]!;
    const v = ctx.variantsByKey.get(ctx.variantOrder[i % ctx.variantOrder.length]!)!;
    const stage = spec.status === 'paid' ? paidStage : billableStage;

    const lines: LineComputed[] = [
      computeLine({
        typeId: catalogTypeId,
        productId: v.productId,
        variantId: v.id,
        description: v.title ? `${v.productTitle} — ${v.title}` : v.productTitle,
        quantity: 1 + (i % 2),
        unitPrice: round2(v.priceCents / 100),
        taxable: true,
      }),
      computeLine({
        typeId: typeId('labor'),
        description: 'Labor',
        quantity: spec.laborHours,
        unitPrice: LABOR_RATE,
        taxable: false,
      }),
      ...(spec.feeCents > 0
        ? [
            computeLine({
              typeId: typeId('fee'),
              description: 'Diagnostic fee',
              quantity: 1,
              unitPrice: round2(spec.feeCents / 100),
              taxable: false,
            }),
          ]
        : []),
    ];

    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
    const total = round2(subtotal + taxTotal);
    const amountPaid =
      spec.status === 'paid' ? total : spec.status === 'partial' ? round2(total * 0.4) : 0;
    const balance = round2(total - amountPaid);
    const createdAt = daysAgo(ctx, spec.createdDaysAgo);
    const settledAt = daysAgo(ctx, Math.max(spec.createdDaysAgo - 3, 0));
    const seq = SAMPLE_SEQ_BASE + i;
    const number = `${numberPrefix}${seq}`;

    const doc = await tx.billingDocument.create({
      data: {
        tenantId,
        propertyId: ctx.issuingPropertyId,
        workflowId: workflow.id,
        stageId: stage.id,
        customerId: party.id,
        number,
        numberSeq: seq,
        currency: 'USD',
        billTo: { name: party.name },
        taxRate: TAX_RATE,
        subtotal,
        taxTotal,
        total,
        amountPaid,
        balance,
        status: spec.status,
        dueAt: spec.dueDaysAgo === null ? null : daysAgo(ctx, spec.dueDaysAgo),
        paidAt: spec.status === 'paid' ? settledAt : null,
        overdueDays:
          spec.status === 'overdue' && spec.dueDaysAgo && spec.dueDaysAgo > 0 ? spec.dueDaysAgo : 0,
        finalizedAt: spec.status === 'void' ? null : createdAt,
        voidedAt: spec.status === 'void' ? daysAgo(ctx, spec.createdDaysAgo - 2) : null,
        notes: 'Thank you for your business.',
        metadata: withSampleMeta(),
        createdAt,
        lines: {
          create: lines.map((l, idx) => ({
            tenantId,
            lineTypeId: l.typeId,
            productId: l.productId ?? null,
            variantId: l.variantId ?? null,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxable: l.taxable,
            taxAmount: l.taxAmount,
            lineSubtotal: l.lineSubtotal,
            lineTotal: l.lineTotal,
            sortOrder: idx,
          })),
        },
      },
      select: { id: true },
    });
    ctx.counts.billingDocuments += 1;

    if (amountPaid > 0) {
      await tx.billingDocumentPayment.create({
        data: {
          tenantId,
          documentId: doc.id,
          kind: 'payment',
          method: spec.status === 'paid' ? 'card' : 'ach',
          amount: amountPaid,
          reference: spec.status === 'paid' ? 'Card •••• 4242' : 'ACH transfer',
          receivedAt: settledAt,
        },
      });
    }

    // Freeze an immutable snapshot when the document lands on a snapshot-on-enter
    // stage (the "receipt" on the Paid stage) — mirrors the real stage transition.
    if (stage.snapshotOnEnter) {
      await tx.billingDocumentSnapshot.create({
        data: {
          tenantId,
          documentId: doc.id,
          stageId: stage.id,
          stageType: stage.stageType,
          customerLabel: stage.customerLabel,
          documentNumber: number,
          snapshot: {
            stage: stage.stageType,
            document: { number, total, balance, status: spec.status },
            party: { name: party.name },
            lines: lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
          createdAt: settledAt,
        },
      });
    }
  }

  // B2B accounts-receivable — the /b2b/invoices surface (billing_documents scoped to
  // a B2BAccount, docs/87 §15). Bills a demo wholesale account so the B2B AR view +
  // credit utilisation aren't empty. b2b implies commerce → invoicing is on, so this
  // runs inside the invoicing gate; keyed on the b2b module.
  if (ctx.isOn('b2b')) {
    await seedB2bAr(ctx, pack, {
      workflowId: workflow.id,
      billableStage,
      paidStage,
      catalogTypeId,
      laborTypeId: typeId('labor'),
      startSeq: SAMPLE_SEQ_BASE + DOC_SPECS.length,
    });
  }
}

interface StageRef {
  id: string;
  stageType: string;
  customerLabel: string;
  snapshotOnEnter: boolean;
  numberPrefix: string | null;
}

interface B2bArOpts {
  workflowId: string;
  billableStage: StageRef;
  paidStage: StageRef;
  catalogTypeId: string | null;
  laborTypeId: string | null;
  startSeq: number;
}

interface B2bArSpec {
  status: 'unpaid' | 'overdue' | 'paid';
  createdDaysAgo: number;
  dueDaysAgo: number;
  laborHours: number;
  qtyBase: number;
}

// A small net-terms AR spread — one open, one overdue (drives aging + credit_used),
// one paid — so the B2B invoices list + the reports aging buckets render real data.
const B2B_AR_SPECS: B2bArSpec[] = [
  { status: 'unpaid', createdDaysAgo: 10, dueDaysAgo: -20, laborHours: 2, qtyBase: 8 },
  { status: 'overdue', createdDaysAgo: 48, dueDaysAgo: 18, laborHours: 3, qtyBase: 12 },
  { status: 'paid', createdDaysAgo: 30, dueDaysAgo: 0, laborHours: 1.5, qtyBase: 6 },
];

/** Seed a demo B2B account + its net-terms AR documents (billing_documents scoped to
 *  the account). Populates `/b2b/invoices`, the B2B reports aging, and the account's
 *  `credit_used`. The account is tagged `sample` so Clear removes it. */
async function seedB2bAr(ctx: ApplyCtx, pack: SampleDataPack, opts: B2bArOpts): Promise<void> {
  const { tx, tenantId } = ctx;
  if (ctx.variantOrder.length === 0) return;

  const b2bPersona = pack.personas.find((p) => p.kind === 'b2b');
  const companyName = b2bPersona?.company ?? b2bPersona?.name ?? 'Wholesale Account';

  const account = await tx.b2BAccount.create({
    data: {
      tenantId,
      companyName,
      pricingTier: 'wholesale',
      paymentTerms: 'net30',
      creditLimit: 50000,
      status: 'active',
      tags: ['sample'],
    },
    select: { id: true },
  });

  const prefix = opts.billableStage.numberPrefix ?? 'INV-';
  let openBalance = 0;

  for (let j = 0; j < B2B_AR_SPECS.length; j++) {
    const spec = B2B_AR_SPECS[j]!;
    const v = ctx.variantsByKey.get(ctx.variantOrder[j % ctx.variantOrder.length]!)!;
    const lines: LineComputed[] = [
      computeLine({
        typeId: opts.catalogTypeId,
        productId: v.productId,
        variantId: v.id,
        description: v.title ? `${v.productTitle} — ${v.title}` : v.productTitle,
        quantity: spec.qtyBase,
        unitPrice: round2(v.priceCents / 100),
        taxable: true,
      }),
      computeLine({
        typeId: opts.laborTypeId,
        description: 'Fulfillment & handling',
        quantity: spec.laborHours,
        unitPrice: LABOR_RATE,
        taxable: false,
      }),
    ];
    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
    const total = round2(subtotal + taxTotal);
    const paid = spec.status === 'paid';
    const amountPaid = paid ? total : 0;
    const balance = round2(total - amountPaid);
    if (!paid) openBalance = round2(openBalance + balance);
    const createdAt = daysAgo(ctx, spec.createdDaysAgo);
    const settledAt = daysAgo(ctx, Math.max(spec.createdDaysAgo - 4, 0));
    const seq = opts.startSeq + j;
    const number = `${prefix}${seq}`;
    const stage = paid ? opts.paidStage : opts.billableStage;

    const doc = await tx.billingDocument.create({
      data: {
        tenantId,
        propertyId: ctx.issuingPropertyId,
        workflowId: opts.workflowId,
        stageId: stage.id,
        b2bAccountId: account.id,
        number,
        numberSeq: seq,
        currency: 'USD',
        billTo: { name: companyName },
        taxRate: TAX_RATE,
        subtotal,
        taxTotal,
        total,
        amountPaid,
        balance,
        status: spec.status,
        dueAt: daysAgo(ctx, spec.dueDaysAgo),
        paidAt: paid ? settledAt : null,
        overdueDays: spec.status === 'overdue' ? spec.dueDaysAgo : 0,
        finalizedAt: createdAt,
        notes: 'Net-terms order charge.',
        metadata: withSampleMeta({ source: 'b2b_ar_sample' }),
        createdAt,
        lines: {
          create: lines.map((l, idx) => ({
            tenantId,
            lineTypeId: l.typeId,
            productId: l.productId ?? null,
            variantId: l.variantId ?? null,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxable: l.taxable,
            taxAmount: l.taxAmount,
            lineSubtotal: l.lineSubtotal,
            lineTotal: l.lineTotal,
            sortOrder: idx,
          })),
        },
      },
      select: { id: true },
    });
    ctx.counts.billingDocuments += 1;

    if (paid) {
      await tx.billingDocumentPayment.create({
        data: {
          tenantId,
          documentId: doc.id,
          kind: 'payment',
          method: 'ach',
          amount: amountPaid,
          reference: 'ACH transfer',
          receivedAt: settledAt,
        },
      });
    }
    if (stage.snapshotOnEnter) {
      await tx.billingDocumentSnapshot.create({
        data: {
          tenantId,
          documentId: doc.id,
          stageId: stage.id,
          stageType: stage.stageType,
          customerLabel: stage.customerLabel,
          documentNumber: number,
          snapshot: {
            stage: stage.stageType,
            document: { number, total, balance, status: spec.status },
            party: { name: companyName },
            lines: lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
          createdAt: settledAt,
        },
      });
    }
  }

  // credit_used = open AR balance. At runtime recomputeTotals → sync_b2b_credit_used
  // maintains this; sample rows are inserted directly, so set it here for parity.
  if (openBalance > 0) {
    await tx.b2BAccount.update({ where: { id: account.id }, data: { creditUsed: openBalance } });
  }
}
