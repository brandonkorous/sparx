// Invoicing print templates (docs/87 §10 Phase 5b) against a real RLS-scoped DB:
//   (1) listOrSeed lazily materializes the built-in default (one default, DRAFT
//       only — getActivePublishedTree is null until publish);
//   (2) publish snapshots the draft → getActivePublishedTree returns the tree;
//   (3) draft-tree autosave updates without publishing;
//   (4) creating + promoting a second template moves the default (one per tenant);
//   (5) the default template can't be deleted (the §10 fallback guarantee).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { billingTemplateService } from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('billing document templates', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('seeds the built-in default on first list (draft only)', async () => {
    const templates = await billingTemplateService.listOrSeed(test.ctx);
    expect(templates).toHaveLength(1);
    expect(templates[0]!.name).toBe('Default');
    expect(templates[0]!.isDefault).toBe(true);
    expect(templates[0]!.published).toBe(false);
    // The default tree carries the data-aware nodes.
    const types = (templates[0]!.tree.children ?? []).map((c) => c.type);
    expect(types).toContain('InvoiceLineTable');
    expect(types).toContain('InvoiceTotals');

    // No published default yet → the code default renderer is in effect.
    expect(await billingTemplateService.getActivePublishedTree(test.ctx)).toBeNull();

    // Idempotent: a second list does not re-seed.
    const again = await billingTemplateService.listOrSeed(test.ctx);
    expect(again).toHaveLength(1);
  });

  it('publishes the default → it becomes the active render tree', async () => {
    const [tpl] = await billingTemplateService.listOrSeed(test.ctx);
    await billingTemplateService.publish(test.ctx, tpl!.id);

    const active = await billingTemplateService.getActivePublishedTree(test.ctx);
    expect(active).not.toBeNull();
    expect(active!.name).toBe('Default');
    expect(active!.tree.type).toBe('Section');
  });

  it('autosaves the draft tree without publishing', async () => {
    const [tpl] = await billingTemplateService.listOrSeed(test.ctx);
    const newTree = {
      id: 'tpl-root',
      type: 'Section',
      children: [{ id: 'only-lines', type: 'InvoiceLineTable' }],
    };
    const updated = await billingTemplateService.update(test.ctx, tpl!.id, { tree: newTree });
    expect(updated.tree.children).toHaveLength(1);
    expect(updated.tree.children![0]!.type).toBe('InvoiceLineTable');
  });

  it('promotes a second template to default (one default per tenant)', async () => {
    const [first] = await billingTemplateService.listOrSeed(test.ctx);
    const second = await billingTemplateService.create(test.ctx, { name: 'Branded' });
    expect(second.isDefault).toBe(false);

    const promoted = await billingTemplateService.setDefault(test.ctx, second.id);
    expect(promoted.isDefault).toBe(true);

    const firstAfter = await billingTemplateService.get(test.ctx, first!.id);
    expect(firstAfter.isDefault).toBe(false);

    // Exactly one default across the tenant.
    const all = await billingTemplateService.listOrSeed(test.ctx);
    expect(all.filter((t) => t.isDefault)).toHaveLength(1);
  });

  it('blocks deleting the default but allows deleting a non-default', async () => {
    const all = await billingTemplateService.listOrSeed(test.ctx);
    const def = all.find((t) => t.isDefault)!;
    const nonDef = all.find((t) => !t.isDefault)!;

    await expect(billingTemplateService.remove(test.ctx, def.id)).rejects.toThrow(/default/i);
    await expect(billingTemplateService.remove(test.ctx, nonDef.id)).resolves.toBeUndefined();
  });
});
