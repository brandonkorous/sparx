// Order-derived B2B net-terms AR as billing documents (docs/87 §15) against a
// real RLS-scoped database:
//   (1) createOrderArDocument builds a finalised, numbered invoice with one line
//       carrying the order total, and re-syncs the account's credit_used;
//   (2) the system `net-terms-ar` workflow is ensured idempotently (a second AR
//       doc reuses it — never a duplicate);
//   (3) recording a full payment clears the balance and releases credit;
//   (4) voiding an open AR document releases its credit.
//
// credit_used is the heart of the B2B credit gate, so every assertion checks the
// account's utilisation tracks the open AR — the property the whole convergence
// must preserve.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NET_TERMS_AR_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';

import {
  companyService,
  b2bArService,
  billingDocumentService,
  billingPaymentService,
  documentWorkflowService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const DAY = 86_400_000;
const future = () => new Date(Date.now() + 30 * DAY);

describe('b2b AR — order-derived billing documents', () => {
  let test: TestContext;
  let accountId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    const account = await companyService.create(test.ctx, {
      companyName: 'Gillett Diesel',
      paymentTerms: 'net30',
    });
    accountId = account.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  async function creditUsed(): Promise<number> {
    return Number((await companyService.get(test.ctx, accountId)).creditUsed);
  }

  it('createOrderArDocument builds a finalised invoice + line, and syncs credit', async () => {
    const doc = await b2bArService.createOrderArDocument(test.ctx, {
      companyId: accountId,
      propertyId: test.propertyId,
      orderId: null,
      amount: 1200.5,
      dueAt: future(),
      description: 'Order O-000001',
    });

    expect(doc.number).toMatch(/^INV-\d{6}$/);
    expect(doc.companyId).toBe(accountId);
    expect(doc.status).toBe('unpaid');
    expect(doc.finalizedAt).not.toBeNull();
    expect(Number(doc.total)).toBe(1200.5);
    expect(Number(doc.balance)).toBe(1200.5);
    expect(doc.lines).toHaveLength(1);
    expect(Number(doc.lines[0]!.lineTotal)).toBe(1200.5);
    expect(doc.lines[0]!.taxable).toBe(false);

    // The document sits on the system net-terms-ar workflow.
    const workflows = await documentWorkflowService.list(test.ctx);
    const ar = workflows.find((w) => w.slug === NET_TERMS_AR_WORKFLOW_SLUG);
    expect(ar).toBeDefined();
    expect(doc.workflowId).toBe(ar!.id);

    // credit_used now reflects the open receivable.
    expect(await creditUsed()).toBe(1200.5);
  });

  it('ensureNetTermsArWorkflow is idempotent — a 2nd AR doc reuses the workflow', async () => {
    const doc = await b2bArService.createOrderArDocument(test.ctx, {
      companyId: accountId,
      propertyId: test.propertyId,
      amount: 100,
      dueAt: future(),
    });

    const arWorkflows = (await documentWorkflowService.list(test.ctx)).filter(
      (w) => w.slug === NET_TERMS_AR_WORKFLOW_SLUG
    );
    expect(arWorkflows).toHaveLength(1); // never duplicated

    // Both open receivables count toward credit.
    expect(await creditUsed()).toBe(1300.5);

    // Void the $100 doc to restore the baseline for the next assertions.
    await b2bArService.voidArDocument(test.ctx, doc.id);
    expect(await creditUsed()).toBe(1200.5);
  });

  it('a full payment clears the balance and releases credit', async () => {
    const { items } = await billingDocumentService.list(test.ctx, {
      companyId: accountId,
      propertyId: test.propertyId,
      status: 'unpaid',
    });
    const doc = items.find((d) => Number(d.total) === 1200.5)!;
    expect(doc).toBeDefined();

    await billingPaymentService.recordPayment(test.ctx, doc.id, {
      kind: 'payment',
      method: 'check',
      amount: 1200.5,
    });

    const paid = await billingDocumentService.get(test.ctx, doc.id);
    expect(paid.status).toBe('paid');
    expect(Number(paid.balance)).toBe(0);
    expect(await creditUsed()).toBe(0);
  });

  it('voiding an open AR document releases its credit', async () => {
    const doc = await b2bArService.createOrderArDocument(test.ctx, {
      companyId: accountId,
      propertyId: test.propertyId,
      amount: 777,
      dueAt: future(),
    });
    expect(await creditUsed()).toBe(777);

    const voided = await b2bArService.voidArDocument(test.ctx, doc.id, {
      note: 'duplicate charge',
    });
    expect(voided.status).toBe('void');
    expect(voided.voidedAt).not.toBeNull();
    expect(await creditUsed()).toBe(0);
  });
});
