// A system workflow's reference name is not the tenant's to move (issue 781).
//
// Three services find their workflow by SLUG, with no document in hand:
// `b2b-ar-service` when a net-terms order settles, `b2b-quote-service` when a
// wholesale customer asks a price, `customer-estimate-service` when a retail one
// does. The print renderer reads the same slug to tell a price OFFER from a
// demand for money, which is what stops a quote printing "Balance due".
//
// All of that was written on a premise stated in crm-schemas: "the system
// workflows are seeded with a slug that does not move." The workflow editor let
// anyone move it, in a field whose own help text invited the change. A rename
// made the lookup miss, so the next quote minted a SECOND "B2B Quotes" workflow
// while every existing quote stayed on the renamed one — and rendered as an
// invoice.
//
// These assertions are the premise, enforced where it is relied upon.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  B2B_QUOTE_WORKFLOW_SLUG,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
  NET_TERMS_AR_WORKFLOW_SLUG,
  isPriceOfferWorkflow,
} from '@wizeworks/crm-schemas/builtins';

import { documentWorkflowService } from '../../src/services/index.js';
import { CrmValidationError } from '../../src/errors.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('the reference name of a workflow the platform runs on', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await documentWorkflowService.bootstrapDefaultWorkflows(test.ctx);
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  /**
   * The workflow with this slug, created if the tenant has not reached the flow
   * that mints it yet.
   *
   * The three system workflows are NOT part of `DEFAULT_DOCUMENT_WORKFLOWS` —
   * each is lazily ensured by the flow that needs it, gated on its own module.
   * How the row arrived is not what these assertions are about; that it carries
   * the slug the platform resolves by is.
   */
  async function bySlug(slug: string, name: string) {
    const all = await documentWorkflowService.list(test.ctx);
    const found = all.find((workflow) => workflow.slug === slug);
    if (found) return found;
    const created = await documentWorkflowService.create(test.ctx, { name, slug });
    return documentWorkflowService.get(test.ctx, created.id);
  }

  it.each([
    ['quotes', B2B_QUOTE_WORKFLOW_SLUG, 'B2B Quotes'],
    ['estimates', CUSTOMER_ESTIMATE_WORKFLOW_SLUG, 'Customer Estimates'],
    ['net-terms receivables', NET_TERMS_AR_WORKFLOW_SLUG, 'Net-terms AR'],
  ])('cannot be changed on the %s workflow', async (_what, slug, name) => {
    const workflow = await bySlug(slug, name);

    await expect(
      documentWorkflowService.update(test.ctx, workflow.id, { slug: 'something-else' })
    ).rejects.toBeInstanceOf(CrmValidationError);

    // And nothing was written on the way to refusing.
    const after = await documentWorkflowService.get(test.ctx, workflow.id);
    expect(after.slug).toBe(slug);
  });

  it('says which name has to stay, and what can still be changed', async () => {
    const workflow = await bySlug(B2B_QUOTE_WORKFLOW_SLUG, 'B2B Quotes');
    // The message is what the owner reads in the editor's error, so the words
    // are part of the contract: it has to name the thing, not just refuse.
    await expect(
      documentWorkflowService.update(test.ctx, workflow.id, { slug: 'my-quotes' })
    ).rejects.toThrow(B2B_QUOTE_WORKFLOW_SLUG);
  });

  it('leaves everything else about it theirs', async () => {
    const workflow = await bySlug(CUSTOMER_ESTIMATE_WORKFLOW_SLUG, 'Customer Estimates');

    const renamed = await documentWorkflowService.update(test.ctx, workflow.id, {
      name: 'Prices I quote',
      isDefault: true,
    });
    expect(renamed.name).toBe('Prices I quote');
    expect(renamed.isDefault).toBe(true);
    // The display name moved; the reference name did not, so the estimate
    // service still finds it and the renderer still knows it holds an offer.
    expect(renamed.slug).toBe(CUSTOMER_ESTIMATE_WORKFLOW_SLUG);
    expect(isPriceOfferWorkflow(renamed.slug)).toBe(true);
  });

  it('still lets a tenant rename a workflow they invented', async () => {
    const mine = await documentWorkflowService.create(test.ctx, {
      name: 'Loom hire',
      slug: 'loom-hire',
    });

    const moved = await documentWorkflowService.update(test.ctx, mine.id, {
      slug: 'loom-rental',
    });
    expect(moved.slug).toBe('loom-rental');
  });

  it('is happy to be handed the name it already has', async () => {
    // The console sends the whole header on every save, so an unrelated change
    // arrives with the slug attached. Refusing that would make a system
    // workflow unsaveable rather than unrenameable.
    const workflow = await bySlug(NET_TERMS_AR_WORKFLOW_SLUG, 'Net-terms AR');
    const saved = await documentWorkflowService.update(test.ctx, workflow.id, {
      name: 'Money owed on terms',
      slug: NET_TERMS_AR_WORKFLOW_SLUG,
    });
    expect(saved.name).toBe('Money owed on terms');
    expect(saved.slug).toBe(NET_TERMS_AR_WORKFLOW_SLUG);
  });
});
