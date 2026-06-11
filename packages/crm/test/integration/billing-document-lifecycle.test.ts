// Invoicing (docs/87) — the authored billing document end to end against a real
// (RLS-scoped) database. The load-bearing behaviors:
//   (1) the default single-stage Invoice mints its INV- number on create (§9),
//   (2) per-line `taxable` × document taxRate — parts taxed, labor not (§7),
//   (3) advancing into a snapshotOnEnter stage freezes an immutable record (§4),
//   (4) a numberOnEnter stage re-stamps the prefix while keeping the suffix —
//       EST-000123 → INV-000123 (§9) — and stamps finalizedAt on a `final` stage,
//   (5) a locksEditing stage freezes lines AND the header,
//   (6) the lifecycle CRM events fire (created / stage_changed / finalized).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
} from '../../src/services/index.js';
import type { BillingSnapshotPayload } from '../../src/services/billing-snapshot.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('billing document lifecycle', () => {
  let test: TestContext;
  let customerId: string;
  let invoiceWorkflowId: string;
  let invoicePaidStageId: string;
  let srWorkflowId: string;
  let srStages: { id: string; name: string }[];

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'walkin@billing.test',
      firstName: 'Walk',
      lastName: 'In',
    });
    customerId = customer.id;

    const workflows = await documentWorkflowService.list(test.ctx);
    const invoice = workflows.find((w) => w.slug === 'invoice');
    const sr = workflows.find((w) => w.slug === 'service-repair');
    if (!invoice || !sr) throw new Error('default workflows not seeded');
    invoiceWorkflowId = invoice.id;
    invoicePaidStageId = invoice.stages[1]!.id;
    srWorkflowId = sr.id;
    srStages = sr.stages.map((s) => ({ id: s.id, name: s.name }));
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('create — default Invoice mints an INV- number on create', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0.08,
    });
    expect(doc.number).toMatch(/^INV-\d{6}$/);
    expect(doc.numberSeq).toBeGreaterThanOrEqual(1);
    expect(doc.status).toBe('unpaid');

    const topics = test.publisher.events.map((e) => e.topic);
    expect(topics).toContain('crm.billing_document.created');
  });

  it('lines — per-line taxable × document rate (parts taxed, labor not)', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0.08,
    });
    // labor: rate × hours, non-taxable by line-type default
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'labor',
      description: 'Diagnostic',
      quantity: 2,
      unitPrice: 95,
    });
    // shop materials: flat, taxable by default
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'materials',
      description: 'Shop materials',
      quantity: 1,
      unitPrice: 50,
    });

    const withLines = await billingDocumentService.get(test.ctx, doc.id);
    expect(Number(withLines.subtotal)).toBe(240); // 190 labor + 50 materials
    expect(Number(withLines.taxTotal)).toBe(4); // 8% of 50; labor untaxed
    expect(Number(withLines.total)).toBe(244);
    expect(withLines.lines).toHaveLength(2);
  });

  it('advance to a snapshot+lock stage — freezes a record and locks edits', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'fee',
      description: 'Disposal fee',
      quantity: 1,
      unitPrice: 25,
    });

    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: invoicePaidStageId });

    const snaps = await billingDocumentStageService.listSnapshots(test.ctx, doc.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.documentNumber).toBe(doc.number);
    const frozen = snaps[0]!.snapshot as unknown as BillingSnapshotPayload;
    expect(frozen.lines).toHaveLength(1);
    expect(frozen.document.totals.total).toBe(25);

    // locksEditing — further line writes and header edits are rejected.
    await expect(
      billingLineService.addLine(test.ctx, doc.id, {
        lineTypeKey: 'fee',
        description: 'late line',
        quantity: 1,
        unitPrice: 5,
      })
    ).rejects.toThrow(/locked/i);
    await expect(
      billingDocumentService.update(test.ctx, doc.id, { notes: 'too late' })
    ).rejects.toThrow(/locked/i);

    // Re-advancing to the same stage is rejected.
    await expect(
      billingDocumentStageService.advance(test.ctx, doc.id, { stageId: invoicePaidStageId })
    ).rejects.toThrow(/already at this stage/i);
  });

  it('Service/Repair — EST→INV keeps the suffix, finalizes, snapshots each stage', async () => {
    const est = await billingDocumentService.create(test.ctx, {
      workflowId: srWorkflowId,
      customerId,
      taxRate: 0,
    });
    expect(est.number).toMatch(/^EST-\d{6}$/);
    const suffix = est.number!.slice(4); // drop "EST-"

    const stageByName = (name: string) => srStages.find((s) => s.name === name)!.id;

    // Estimate → Approved (committed, snapshot) → In Progress → Invoiced (final,
    // number re-stamp, snapshot, lock).
    await billingDocumentStageService.advance(test.ctx, est.id, { stageId: stageByName('Approved') });
    await billingDocumentStageService.advance(test.ctx, est.id, {
      stageId: stageByName('In Progress'),
    });
    await billingDocumentStageService.advance(test.ctx, est.id, { stageId: stageByName('Invoiced') });

    const fresh = await billingDocumentService.get(test.ctx, est.id);
    expect(fresh.number).toBe(`INV-${suffix}`); // same suffix, swapped prefix (§9)
    expect(fresh.finalizedAt).not.toBeNull();

    // Two snapshots: the Approved estimate (EST-) and the final invoice (INV-).
    const snaps = await billingDocumentStageService.listSnapshots(test.ctx, est.id);
    expect(snaps).toHaveLength(2);
    const numbers = snaps.map((s) => s.documentNumber).sort();
    expect(numbers).toEqual([`EST-${suffix}`, `INV-${suffix}`]);

    const topics = test.publisher.events.map((e) => e.topic);
    expect(topics).toContain('crm.billing_document.stage_changed');
    expect(topics).toContain('crm.billing_document.finalized');
  });

  it('advance rejects a stage from another workflow', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: srWorkflowId,
      customerId,
      taxRate: 0,
    });
    await expect(
      billingDocumentStageService.advance(test.ctx, doc.id, { stageId: invoicePaidStageId })
    ).rejects.toThrow();
  });
});
