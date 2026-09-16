// MONEY THAT IS LATE, AND THE SCREEN THAT COULD NOT SEE IT.
//
// `billing_documents.status` is written by `recomputeTotals`, which runs when
// something is DONE to a document: a line, a payment, a void. A due date passing
// is not something being done. So a bill that goes late while nobody touches it
// keeps saying `partial` or `unpaid` for ever, and every screen that asks
// `status = 'overdue'` cannot see it.
//
// The B2B dunning scan re-marks its own accounts, which is why B2B looked fine —
// every late B2B invoice on the dev database was correctly `overdue`. A shop
// billing ordinary customers has nothing doing that for it. Measured there: 54
// documents and $51,456.69 genuinely past due, of which `status = 'overdue'`
// found 30 and $26,983.76. One shop was owed $986.50 across eight late invoices
// and the "Overdue" view it ships with was empty.
//
// The aging report had it right the whole time, because it derives from
// `due_at`. Two screens, one question, $24,472.93 apart.
//
// These tests set the status and the due date by hand on purpose: that is
// exactly the state the database arrives in when a due date passes and nobody
// touches the document, and it is the state no fixture would otherwise produce.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@wizeworks/db';

import {
  billingDocumentService,
  billingFromOrderService,
  customerService,
  documentLineTypeService,
  documentWorkflowService,
  orderService,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const DAY = 86_400_000;

describe('a bill that went late while nobody was looking', () => {
  let test: TestContext;
  let customerId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(test.ctx);
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'late@invoice.test',
      firstName: 'Marguerite',
      lastName: 'Adeyemi',
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  /**
   * An invoice for an order, forced into the state a document reaches by the
   * passage of time alone: a due date in the past and a status nobody rewrote.
   */
  const staleInvoice = async (opts: {
    dueInDays: number;
    status: string;
    amountPaid?: number;
    unitPrice?: number;
  }) => {
    const order = await orderService.create(test.ctx, {
      customerId,
      items: [
        {
          sku: 'SILK-SCARF',
          name: 'Silk twill scarf',
          quantity: 1,
          unitPrice: opts.unitPrice ?? 58,
        },
      ],
    });
    const { document } = await billingFromOrderService.createInvoiceForOrder(test.ctx, {
      orderId: order.id,
    });
    const total = Number(document.total);
    const paid = opts.amountPaid ?? 0;
    await withTenant({ tenantId: test.tenant.tenantId }, (tx) =>
      tx.billingDocument.update({
        where: { id: document.id },
        data: {
          dueAt: new Date(Date.now() + opts.dueInDays * DAY),
          status: opts.status,
          amountPaid: paid,
          balance: total - paid,
        },
      })
    );
    return { id: document.id, orderId: order.id, total };
  };

  it('is found by the filter that asks the due date, and only it', async () => {
    const late = await staleInvoice({ dueInDays: -8, status: 'partial', amountPaid: 40 });
    const early = await staleInvoice({ dueInDays: 14, status: 'unpaid' });

    const { items } = await billingDocumentService.list(test.ctx, { pastDue: true });
    const ids = items.map((d) => d.id);

    // BOTH halves, deliberately. "Contains the late one" alone passes just as
    // happily when the filter is ignored entirely and the list returns
    // everything — which is exactly what it did before this existed, so a test
    // written that way could never have gone red on the defect it names.
    expect(ids).toContain(late.id);
    expect(ids).not.toContain(early.id);
  });

  it('is INVISIBLE to the filter that asks the status column', async () => {
    // The defect, stated as a test rather than as a comment. This is what the
    // shipped "Overdue" saved view did, and why one shop's Overdue list was
    // empty while it was owed $986.50.
    const late = await staleInvoice({ dueInDays: -8, status: 'partial', amountPaid: 40 });

    const { items } = await billingDocumentService.list(test.ctx, { status: 'overdue' });
    expect(items.map((d) => d.id)).not.toContain(late.id);
  });

  it('reports itself as late on the order it belongs to', async () => {
    // The order pane reads this list and has a "Late" badge it could never
    // reach: the row said `partial`, so it rendered "Part paid" over a bill that
    // was eight days overdue with money outstanding.
    const late = await staleInvoice({ dueInDays: -8, status: 'partial', amountPaid: 40 });

    const invoices = await billingFromOrderService.listInvoicesForOrder(test.ctx, late.orderId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.status).toBe('overdue');
  });

  it('is not late on the day it is due', async () => {
    // A bill due today is not late at three in the afternoon. Comparing instants
    // instead of dates makes it late partway through its own due date — the trap
    // `daysPastDue` exists to avoid, and the query has to avoid it too.
    const dueToday = await staleInvoice({ dueInDays: 0, status: 'unpaid' });

    const { items } = await billingDocumentService.list(test.ctx, { pastDue: true });
    expect(items.map((d) => d.id)).not.toContain(dueToday.id);
  });

  it('leaves alone money that has already been paid', async () => {
    // A paid document has a due date in the past too, and nobody is waiting for
    // it. Ignoring status entirely would fill the list with settled invoices and
    // teach somebody to stop reading it.
    const settled = await staleInvoice({
      dueInDays: -30,
      status: 'paid',
      amountPaid: 58,
      unitPrice: 58,
    });

    const { items } = await billingDocumentService.list(test.ctx, { pastDue: true });
    expect(items.map((d) => d.id)).not.toContain(settled.id);
  });

  it('leaves alone a bill that is not due yet', async () => {
    const future = await staleInvoice({ dueInDays: 14, status: 'unpaid' });

    const { items } = await billingDocumentService.list(test.ctx, { pastDue: true });
    expect(items.map((d) => d.id)).not.toContain(future.id);
  });
});
