// Archiving a workflow had no undo (issue 783).
//
// `DELETE /v1/invoicing/workflows/:id` sets `archived_at` and nothing ever set
// it back. The list even had an Archived filter, so a tenant could FIND what
// they had put away, open it, read a badge saying Archived — and then there was
// nothing to press. The confirm meanwhile described a reversible change:
// "it stops being offered … documents already using it are untouched and keep
// working exactly as they do now."
//
// One detail is deliberate and is asserted below: restoring does NOT give the
// workflow its default flag back. Archiving stands it down, and by the time
// anyone restores it something else is almost certainly the default — quietly
// taking that back would move every new document onto a workflow the tenant had
// put away.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { documentWorkflowService } from '../../src/services/index.js';
import { CrmNotFoundError } from '../../src/errors.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('putting a workflow back', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('brings an archived workflow back into the list', async () => {
    const made = await documentWorkflowService.create(test.ctx, {
      name: 'Loom hire',
      slug: 'loom-hire',
    });

    await documentWorkflowService.archive(test.ctx, made.id);
    const gone = await documentWorkflowService.list(test.ctx);
    expect(gone.some((workflow) => workflow.id === made.id)).toBe(false);

    const back = await documentWorkflowService.restore(test.ctx, made.id);
    expect(back.archivedAt).toBeNull();

    const active = await documentWorkflowService.list(test.ctx);
    expect(active.some((workflow) => workflow.id === made.id)).toBe(true);
  });

  it('leaves the stages exactly as they were', async () => {
    const made = await documentWorkflowService.create(test.ctx, {
      name: 'Commission weave',
      slug: 'commission-weave',
    });
    await documentWorkflowService.createStage(test.ctx, made.id, {
      name: 'Deposit',
      customerLabel: 'Deposit due',
      stageType: 'open',
      numberOnEnter: true,
      numberPrefix: 'DEP-',
      sortOrder: 0,
    });

    await documentWorkflowService.archive(test.ctx, made.id);
    const back = await documentWorkflowService.restore(test.ctx, made.id);
    expect(back.archivedAt).toBeNull();

    const full = await documentWorkflowService.get(test.ctx, made.id);
    expect(full.stages).toHaveLength(1);
    expect(full.stages[0]!.customerLabel).toBe('Deposit due');
    expect(full.stages[0]!.numberPrefix).toBe('DEP-');
  });

  it('does not hand back the default flag it took away', async () => {
    const mine = await documentWorkflowService.create(test.ctx, {
      name: 'Retail',
      slug: 'retail',
      isDefault: true,
    });
    expect(mine.isDefault).toBe(true);

    await documentWorkflowService.archive(test.ctx, mine.id);

    // What a tenant does next: pick something else to be the default.
    const replacement = await documentWorkflowService.create(test.ctx, {
      name: 'Trade',
      slug: 'trade',
      isDefault: true,
    });

    const back = await documentWorkflowService.restore(test.ctx, mine.id);
    expect(back.isDefault).toBe(false);

    const still = await documentWorkflowService.get(test.ctx, replacement.id);
    expect(still.isDefault).toBe(true);
  });

  it('is a no-op on one that was never archived', async () => {
    const made = await documentWorkflowService.create(test.ctx, {
      name: 'Repairs',
      slug: 'repairs',
    });
    const back = await documentWorkflowService.restore(test.ctx, made.id);
    expect(back.archivedAt).toBeNull();
    expect(back.name).toBe('Repairs');
  });

  it('says so when there is nothing there', async () => {
    await expect(
      documentWorkflowService.restore(test.ctx, '00000000-0000-0000-0000-000000000000')
    ).rejects.toBeInstanceOf(CrmNotFoundError);
  });
});
