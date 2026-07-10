// B2B quote lifecycle — a quote/RFQ IS a BillingDocument on the system
// `b2b-quotes` workflow (docs/87 §15 convergence; retires the standalone
// Quote/quoteService/quoteLifecycleService model). The load-bearing behaviors:
//   (1) the workflow is lazily ensured with its seeded Draft→…→Accepted/Declined
//       stages, numbering the document on entering Draft,
//   (2) advancing through stages fires crm.billing_document.stage_changed and
//       freezes a snapshot on the customer-approved (committed) stage,
//   (3) a locked (void/locksEditing) stage rejects further line edits,
//   (4) convertToOrder only accepts a `committed`-stage document, snapshots its
//       lines into a real Order, and refuses a second conversion.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  b2bQuoteService,
  billingDocumentConversionService,
  billingDocumentService,
  billingDocumentStageService,
  billingLineService,
  customerService,
  documentWorkflowService,
} from '../../src/services/index.js';
import {
  getPlatformBus,
  resetPlatformBusForTesting,
  type PlatformEvent,
} from '../../src/consumers/platform-bus.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('b2b quote lifecycle (BillingDocument on the b2b-quotes workflow)', () => {
  let test: TestContext;
  let customerId: string;
  let workflowId: string;
  let stageIdByName: Map<string, string>;
  const platformEvents: PlatformEvent[] = [];

  beforeAll(async () => {
    test = await makeTestContext('owner');
    const bus = resetPlatformBusForTesting();
    bus.subscribe('order.created', (e) => {
      platformEvents.push(e);
      return Promise.resolve();
    });

    const customer = await customerService.create(test.ctx, {
      type: 'b2b',
      email: 'buyer@quotelifecycle.test',
      company: 'Quote Test Co',
    });
    customerId = customer.id;

    await b2bQuoteService.bootstrapB2bQuoteWorkflow(test.ctx);
    const workflows = await documentWorkflowService.list(test.ctx);
    const workflow = workflows.find((w) => w.slug === b2bQuoteService.B2B_QUOTE_WORKFLOW_SLUG);
    if (!workflow) throw new Error('b2b-quotes workflow was not seeded');
    workflowId = workflow.id;
    stageIdByName = new Map(workflow.stages.map((s) => [s.name, s.id]));
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
    platformEvents.length = 0;
  });

  function stageId(name: string): string {
    const id = stageIdByName.get(name);
    if (!id) throw new Error(`Stage "${name}" missing from seeded b2b-quotes workflow`);
    return id;
  }

  it('create — drafts a quote, numbering it on entering Draft', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId,
      stageId: stageId('Draft'),
      customerId,
    });
    expect(doc.number).toMatch(/^Q-\d+$/);
    expect(doc.stageId).toBe(stageId('Draft'));

    await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Q item A',
      quantity: 2,
      unitPrice: 50,
    });
    const withLine = await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Q item B',
      quantity: 1,
      unitPrice: 25,
    });
    expect(withLine.lines).toHaveLength(2);
    expect(Number(withLine.subtotal)).toBe(125);
  });

  it('lifecycle — Draft → Submitted → Quoted → Accepted fires stage-changed + freezes a snapshot', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId,
      stageId: stageId('Draft'),
      customerId,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Lifecycle item',
      quantity: 1,
      unitPrice: 100,
    });

    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Submitted') });
    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Quoted') });
    const accepted = await billingDocumentStageService.advance(test.ctx, doc.id, {
      stageId: stageId('Accepted'),
    });
    expect(accepted.stageId).toBe(stageId('Accepted'));

    const crmTopics = test.publisher.events.map((e) => e.topic);
    expect(crmTopics.filter((t) => t === 'crm.billing_document.stage_changed')).toHaveLength(3);

    // Accepted is snapshotOnEnter — the approved quote is frozen.
    const snapshots = await billingDocumentStageService.listSnapshots(test.ctx, doc.id);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.stageId).toBe(stageId('Accepted'));
  });

  it('decline — a void/locksEditing stage rejects further line edits', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId,
      stageId: stageId('Draft'),
      customerId,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Decline test',
      quantity: 1,
      unitPrice: 1,
    });
    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Submitted') });

    await billingDocumentService.update(test.ctx, doc.id, { declinedReason: 'budget' });
    const declined = await billingDocumentStageService.advance(test.ctx, doc.id, {
      stageId: stageId('Declined'),
    });
    expect(declined.stageId).toBe(stageId('Declined'));
    expect(declined.declinedReason).toBe('budget');
    expect(declined.voidedAt).not.toBeNull();

    await expect(
      billingLineService.addLine(test.ctx, doc.id, {
        description: 'Too late',
        quantity: 1,
        unitPrice: 1,
      })
    ).rejects.toThrow();
  });

  it('convertToOrder — requires a committed stage, snapshots lines into a real order, refuses a second conversion', async () => {
    const doc = await billingDocumentService.create(test.ctx, {
      workflowId,
      stageId: stageId('Draft'),
      customerId,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Convert A',
      quantity: 2,
      unitPrice: 100,
    });
    await billingLineService.addLine(test.ctx, doc.id, {
      description: 'Convert B',
      quantity: 1,
      unitPrice: 30,
    });

    // Not yet committed — conversion is rejected.
    await expect(billingDocumentConversionService.convertToOrder(test.ctx, doc.id)).rejects.toThrow(
      /committed/
    );

    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Submitted') });
    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Quoted') });
    await billingDocumentStageService.advance(test.ctx, doc.id, { stageId: stageId('Accepted') });
    platformEvents.length = 0;

    const { document: converted, order } = await billingDocumentConversionService.convertToOrder(
      test.ctx,
      doc.id
    );

    expect(converted.stageId).toBe(stageId('Accepted')); // conversion doesn't re-stage the document
    expect(order.convertedFromDocumentId).toBe(doc.id);
    expect(order.status).toBe('placed');
    expect(Number(order.total)).toBe(230);

    await getPlatformBus().drain();
    const created = platformEvents.filter((e) => e.topic === 'order.created');
    expect(created).toHaveLength(1);

    // Idempotency — a document can only convert to one order.
    await expect(
      billingDocumentConversionService.convertToOrder(test.ctx, doc.id)
    ).rejects.toThrow(/already been converted/);
  });
});
