// Invoicing payments / AR (docs/87 §8) against a real RLS-scoped database:
//   (1) deposit → partial → paid drives the payment-derived status + fires the
//       crm.billing_document.paid event when the balance first clears,
//   (2) a refund reopens a paid document,
//   (3) the B2B escalation ladder reads OPEN BILLING-DOCUMENT balances (the sole
//       AR source post docs/87 §15) — a past-due authored invoice is marked
//       overdue and escalates the account.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  b2bAccountService,
  b2bEscalationService,
  billingDocumentService,
  billingLineService,
  billingPaymentService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const DAY = 86_400_000;

describe('billing document payments / AR', () => {
  let test: TestContext;
  let customerId: string;
  let invoiceWorkflowId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'payer@billing.test',
      firstName: 'Pay',
      lastName: 'Er',
    });
    customerId = customer.id;

    const workflows = await documentWorkflowService.list(test.ctx);
    invoiceWorkflowId = workflows.find((w) => w.slug === 'invoice')!.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  async function newInvoiceWith(unitPrice: number) {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      customerId,
      taxRate: 0,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'fee',
      description: 'Service',
      quantity: 1,
      unitPrice,
    });
    return doc.id;
  }

  it('deposit → partial → paid, then emits the paid event', async () => {
    const docId = await newInvoiceWith(100);

    await billingPaymentService.recordPayment(test.ctx, docId, {
      kind: 'deposit',
      method: 'card',
      amount: 40,
    });
    let doc = await billingDocumentService.get(test.ctx, docId);
    expect(doc.status).toBe('partial');
    expect(Number(doc.amountPaid)).toBe(40);
    expect(Number(doc.depositTotal)).toBe(40);
    expect(Number(doc.balance)).toBe(60);

    await billingPaymentService.recordPayment(test.ctx, docId, {
      kind: 'payment',
      method: 'cash',
      amount: 60,
    });
    doc = await billingDocumentService.get(test.ctx, docId);
    expect(doc.status).toBe('paid');
    expect(Number(doc.balance)).toBe(0);
    expect(doc.paidAt).not.toBeNull();

    const topics = test.publisher.events.map((e) => e.topic);
    expect(topics).toContain('crm.billing_document.paid');
  });

  it('a refund reopens a paid document', async () => {
    const docId = await newInvoiceWith(100);
    await billingPaymentService.recordPayment(test.ctx, docId, {
      kind: 'payment',
      method: 'cash',
      amount: 100,
    });
    expect((await billingDocumentService.get(test.ctx, docId)).status).toBe('paid');

    await billingPaymentService.recordPayment(test.ctx, docId, {
      kind: 'refund',
      method: 'cash',
      amount: 20,
    });
    const doc = await billingDocumentService.get(test.ctx, docId);
    expect(doc.status).toBe('partial');
    expect(Number(doc.amountPaid)).toBe(80);
    expect(Number(doc.balance)).toBe(20);

    const payments = await billingPaymentService.listPayments(test.ctx, docId);
    expect(payments).toHaveLength(2);
  });

  it('escalation dual-reads an overdue authored invoice and ladders the account', async () => {
    const account = await b2bAccountService.create(test.ctx, {
      companyName: 'Fleet Co',
      paymentTerms: 'net30',
    });
    // Due in the future so the create/line recompute leaves it `unpaid` — the
    // escalation scan (at a simulated later clock) is what marks it overdue.
    const dueAt = new Date(Date.now() + 5 * DAY);
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId: invoiceWorkflowId,
      b2bAccountId: account.id,
      taxRate: 0,
      dueAt: dueAt.toISOString(),
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      lineTypeKey: 'fee',
      description: 'Fleet service',
      quantity: 1,
      unitPrice: 500,
    });
    expect((await billingDocumentService.get(test.ctx, doc.id)).status).toBe('unpaid');

    // 20 days past the due date.
    const simulatedNow = new Date(dueAt.getTime() + 20 * DAY);
    const result = await b2bEscalationService.escalateAccount(test.ctx, account.id, {
      now: simulatedNow,
    });

    const docEntry = result.freshlyOverdue.find((f) => f.source === 'billing_document');
    expect(docEntry).toBeDefined();
    expect(docEntry!.id).toBe(doc.id);
    expect(docEntry!.amountCents).toBe(50_000); // $500 balance → cents
    expect(result.maxOverdueDays).toBeGreaterThanOrEqual(14);
    expect(result.transition).toBe('credit_hold');

    const fresh = await billingDocumentService.get(test.ctx, doc.id);
    expect(fresh.status).toBe('overdue');
    expect(fresh.overdueDays).toBeGreaterThanOrEqual(20);
  });
});
