// Invoicing print render (docs/87 §10) against a real RLS-scoped database:
//   (1) buildRenderData assembles a live document — title = the stage's customer
//       label, line-type labels resolved, party derived from the customer record,
//       totals carried through;
//   (2) an author-set billTo JSON overrides the customer fallback;
//   (3) a B2B-billed document derives the party from the account;
//   (4) buildRenderDataFromSnapshot reprints a FROZEN record (frozen number +
//       lines + totals), and the assembled data renders to print HTML.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  b2bAccountService,
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  billingRenderService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
  renderBillingDocumentHtml,
} from '../../src/services/index.js';
import { DEFAULT_DOCUMENT_LINE_TYPES } from '@sparx/crm-schemas/builtins';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** The customer-facing label a builtin line type renders with.
 *
 *  Read from the catalog rather than hardcoded. These labels are PRODUCT COPY —
 *  'labor' was renamed from "Labor" to "Service" and 'fee' from "Misc / Flat
 *  Fee" to "Fee", both to keep the platform's language industry-agnostic — and a
 *  test that pins the strings turns every such rename into a red suite while
 *  proving nothing extra. What is actually under test here is that the line-type
 *  JOIN resolves at all, which this still asserts. */
function labelOf(key: string): string {
  const t = DEFAULT_DOCUMENT_LINE_TYPES.find((lt) => lt.key === key);
  if (!t) throw new Error(`No builtin line type '${key}' — the catalog key changed.`);
  return t.label;
}

describe('billing document render', () => {
  let test: TestContext;
  let customerId: string;
  let invoiceWorkflowId: string;
  let srWorkflowId: string;
  let srApprovedStageId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'printme@billing.test',
      firstName: 'Print',
      lastName: 'Me',
    });
    customerId = customer.id;

    const workflows = await documentWorkflowService.list(test.ctx);
    const invoice = workflows.find((w) => w.slug === 'invoice')!;
    const sr = workflows.find((w) => w.slug === 'service-repair')!;
    invoiceWorkflowId = invoice.id;
    srWorkflowId = sr.id;
    srApprovedStageId = sr.stages.find((s) => s.name === 'Approved')!.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('assembles live render data — label, line types, party, totals', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'labor',
      description: 'Diagnostic',
      quantity: 2,
      unitPrice: 95,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'fee',
      description: 'Disposal fee',
      quantity: 1,
      unitPrice: 25,
    });

    const data = await billingRenderService.buildRenderData(test.ctx, doc.id);

    expect(data.title).toBe('Invoice'); // the invoice stage's customerLabel
    expect(data.number).toMatch(/^INV-\d{6}$/);
    expect(data.lines).toHaveLength(2);
    expect(data.lines[0]!.typeLabel).toBe(labelOf('labor'));
    expect(data.lines[1]!.typeLabel).toBe(labelOf('fee'));
    expect(data.billTo).not.toBeNull();
    expect(data.billTo!.name).toBe('Print Me');
    expect(data.billTo!.lines).toContain('printme@billing.test');
    expect(data.totals.total).toBe(215); // 190 labor + 25 fee, no tax

    // The assembled data renders to a complete HTML document.
    const html = renderBillingDocumentHtml(data);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(data.number!);
    expect(html).toContain('Diagnostic');
  });

  it('prefers an author-set billTo JSON over the customer fallback', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0,
      billTo: {
        name: 'Fleet Dept — PO #88',
        line1: '100 Depot Rd',
        city: 'Visalia',
        state: 'CA',
        postalCode: '93291',
      },
    });
    const data = await billingRenderService.buildRenderData(test.ctx, doc.id);
    expect(data.billTo!.name).toBe('Fleet Dept — PO #88');
    expect(data.billTo!.lines).toContain('100 Depot Rd');
    expect(data.billTo!.lines).toContain('Visalia, CA, 93291');
  });

  it('derives the party from the B2B account when billed to one', async () => {
    const account = await b2bAccountService.create(test.ctx, { companyName: 'Gillett Diesel' });
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      b2bAccountId: account.id,
      taxRate: 0,
    });
    const data = await billingRenderService.buildRenderData(test.ctx, doc.id);
    expect(data.billTo!.name).toBe('Gillett Diesel');
  });

  it('reprints a frozen snapshot exactly as captured', async () => {
    const est = await billingDocumentService.create(test.ctx, {
      workflowId: srWorkflowId,
      customerId,
      taxRate: 0,
    });
    await billingLineService.addLine(test.ctx, est.id, {
      lineTypeKey: 'fee',
      description: 'Inspection',
      quantity: 1,
      unitPrice: 80,
    });
    await billingDocumentStageService.advance(test.ctx, est.id, { stageId: srApprovedStageId });

    const snaps = await billingDocumentStageService.listSnapshots(test.ctx, est.id);
    expect(snaps).toHaveLength(1);
    const snapshotId = snaps[0]!.id;

    const data = await billingRenderService.buildRenderDataFromSnapshot(test.ctx, snapshotId);
    expect(data.number).toMatch(/^EST-\d{6}$/);
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0]!.description).toBe('Inspection');
    expect(data.lines[0]!.typeLabel).toBe(labelOf('fee'));
    expect(data.totals.total).toBe(80);

    const html = renderBillingDocumentHtml(data);
    expect(html).toContain(data.number!);
    expect(html).toContain('Inspection');
  });
});
