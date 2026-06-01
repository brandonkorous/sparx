// assignmentService — the SB-owned layout assignment (docs/36 §6,
// docs/handoffs/sitebuilder-pc-spec.md). Covers the per-target default + per-item
// override upserts, the resolution read that powers the editor picker, target/
// ownership safety, and the LIVE snapshot wiring (getDraftSnapshot surfaces the
// resolver maps the storefront cascades over).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assignmentService, pageLayoutService, publishService } from '../../src/services/index.js';
import { SitebuilderValidationError } from '../../src/errors.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('sitebuilder layout assignment', () => {
  let test: TestContext;
  let spotlightId: string;
  let collectionLayoutId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    // A second product layout to assign (key !== 'default'), plus a collection
    // layout used to prove target safety.
    const spotlight = await pageLayoutService.getOrCreate(test.ctx, {
      targetId: 'commerce:product',
      key: 'spotlight',
    });
    spotlightId = spotlight.id;
    const coll = await pageLayoutService.getOrCreate(test.ctx, {
      targetId: 'commerce:collection',
    });
    collectionLayoutId = coll.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('setDefault — sets the per-target default; resolution reflects it', async () => {
    await assignmentService.setDefault(test.ctx, {
      targetId: 'commerce:product',
      pageLayoutId: spotlightId,
    });
    const res = await assignmentService.getResolution(test.ctx, 'commerce:product', 'prod-1');
    expect(res.defaultLayoutId).toBe(spotlightId);
    expect(res.assignedLayoutId).toBeNull();
  });

  it('listDefaults — surfaces every per-target default (Layouts surface badges)', async () => {
    const defaults = await assignmentService.listDefaults(test.ctx);
    expect(defaults).toContainEqual({
      targetId: 'commerce:product',
      pageLayoutId: spotlightId,
    });
  });

  it('assign — pins one item; resolution returns the override', async () => {
    await assignmentService.assign(test.ctx, {
      targetId: 'commerce:product',
      itemRef: 'prod-1',
      pageLayoutId: spotlightId,
    });
    const res = await assignmentService.getResolution(test.ctx, 'commerce:product', 'prod-1');
    expect(res.assignedLayoutId).toBe(spotlightId);
  });

  it('getDraftSnapshot — surfaces the LIVE resolver maps as layoutKeys', async () => {
    const snap = await publishService.getDraftSnapshot(test.ctx);
    expect(snap.assignments?.defaults['commerce:product']).toBe('spotlight');
    expect(snap.assignments?.items).toContainEqual({
      targetId: 'commerce:product',
      itemRef: 'prod-1',
      layoutKey: 'spotlight',
    });
  });

  it('target safety — assigning a collection layout under commerce:product is rejected', async () => {
    await expect(
      assignmentService.assign(test.ctx, {
        targetId: 'commerce:product',
        itemRef: 'prod-2',
        pageLayoutId: collectionLayoutId,
      })
    ).rejects.toBeInstanceOf(SitebuilderValidationError);
  });

  it('unassign + clearDefault — resolution falls back to nothing', async () => {
    await assignmentService.unassign(test.ctx, 'commerce:product', 'prod-1');
    await assignmentService.clearDefault(test.ctx, 'commerce:product');
    const res = await assignmentService.getResolution(test.ctx, 'commerce:product', 'prod-1');
    expect(res.assignedLayoutId).toBeNull();
    expect(res.defaultLayoutId).toBeNull();
  });
});
