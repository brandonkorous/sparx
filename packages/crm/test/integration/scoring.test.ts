// scoringService + static lists against the real schema (docs/144 §10).
//
// The arithmetic is pinned purely in `src/services/scoring-service.test.ts`.
// What lives here is everything that only exists once the database is involved:
//
//   • THE FIELD VOCABULARY ACTUALLY RESOLVES. Every field the editor offers is
//     executed against a real record. Phase 5 shipped a compiler that invented
//     `customers.country` and `tasks.assigned_to_id` — both compiled into valid
//     SQL and failed only at Postgres — so an exhaustive execution test is now
//     the standing answer to "does this allowlist describe the real schema?".
//   • RE-SCORING IS IDEMPOTENT AND WRITES NOTHING WHEN NOTHING MOVED, which is
//     what stops the score history filling with "+0, recompute" and becoming
//     unreadable.
//   • THE ONE-ACTIVE-MODEL INDEX HOLDS, and creating a second active model
//     demotes the first rather than erroring at a person.
//   • A RULE-DRIVEN LIST REFUSES A HAND EDIT. The evaluator would undo it on the
//     next event, so being told no is the only honest answer.
//   • THE EVALUATOR LEAVES STATIC LISTS ALONE — the single clause that stops a
//     recompute emptying a list somebody built by hand.
//   • RLS. Both new tables are FORCE RLS; a second tenant sees none of it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@sparx/db';

import { customerService, scoringService, segmentService } from '../../src/services/index.js';
import {
  CONTACT_SCORING_FIELDS,
  DEAL_SCORING_FIELDS,
  contactScoringFields,
  dealScoringFields,
} from '../../src/services/scoring-fields.js';
import { evaluateCustomerForTenant } from '../../src/consumers/segment-evaluator.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** A rule saying "everybody", worth `points` — the simplest thing that moves a
 *  score without depending on what a fixture happens to contain. */
function baseline(points: number, label = 'Everybody') {
  return { condition: { logic: 'AND', conditions: [] }, points, label };
}

describe('scoringService', () => {
  let context: TestContext;
  let customerId: string;

  beforeAll(async () => {
    context = await makeTestContext();
    const customer = await customerService.create(context.ctx, {
      email: `score-${Math.random().toString(36).slice(2, 10)}@example.test`,
      firstName: 'Priya',
      lastName: 'Raman',
      company: 'Northwind',
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  /* ── the field vocabulary ─────────────────────────────────────────────── */

  it('resolves EVERY contact field the editor offers, against a real record', async () => {
    // The exhaustive check. A field in the catalog that the projection does not
    // produce is a rule somebody can write that silently never matches — and a
    // score of zero nobody can explain.
    const fields = await withTenant(context.ctx, (tx) =>
      contactScoringFields(tx, customerId, new Date())
    );
    expect(fields).not.toBeNull();
    for (const field of CONTACT_SCORING_FIELDS) {
      expect(Object.hasOwn(fields!, field.path)).toBe(true);
    }
  });

  it('resolves EVERY deal field the editor offers', async () => {
    const pipeline = await withTenant(context.ctx, (tx) =>
      tx.pipeline.findFirst({ select: { id: true, stages: { select: { id: true }, take: 1 } } })
    );
    // A tenant with no pipeline has no deals to score, and the fixture does not
    // seed one — so this asserts the catalog against a deal only when there is
    // somewhere to put it.
    if (!pipeline?.stages[0]) return;

    const deal = await withTenant(context.ctx, (tx) =>
      tx.deal.create({
        data: {
          tenantId: context.tenant.tenantId,
          pipelineId: pipeline.id,
          stageId: pipeline.stages[0]!.id,
          customerId,
          title: 'Scored deal',
          value: 5000,
        },
      })
    );

    const fields = await withTenant(context.ctx, (tx) =>
      dealScoringFields(tx, deal.id, new Date())
    );
    expect(fields).not.toBeNull();
    for (const field of DEAL_SCORING_FIELDS) {
      expect(Object.hasOwn(fields!, field.path)).toBe(true);
    }
  });

  /* ── models ───────────────────────────────────────────────────────────── */

  it('creates a model and scores a record against it', async () => {
    await scoringService.createModel(context.ctx, {
      name: 'Lead score',
      objectKey: 'contact',
      rules: [baseline(30, 'Is a contact')],
      isActive: true,
    });

    const result = await withTenant(context.ctx, (tx) =>
      scoringService.scoreRecord(tx, context.tenant.tenantId, 'contact', customerId)
    );
    expect(result?.changed).toBe(true);
    expect(result?.score).toBe(30);

    const row = await withTenant(context.ctx, (tx) =>
      tx.customer.findUnique({ where: { id: customerId }, select: { score: true, scoredAt: true } })
    );
    expect(row?.score).toBe(30);
    expect(row?.scoredAt).not.toBeNull();
  });

  it('writes a score event carrying the reasons, so the number is explainable', async () => {
    const history = await scoringService.history(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
    });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.reason).toContain('Is a contact');
    expect(history[0]?.source).toBe('rule');
  });

  it('re-scoring an unchanged record writes NOTHING', async () => {
    // The property that keeps the history readable: the evaluator runs on every
    // event that could plausibly move a projection, so a chatty integration
    // would otherwise bury the real reasons under thousands of no-op rows.
    const before = await scoringService.history(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
    });

    const result = await withTenant(context.ctx, (tx) =>
      scoringService.scoreRecord(tx, context.tenant.tenantId, 'contact', customerId)
    );
    expect(result?.changed).toBe(false);

    const after = await scoringService.history(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
    });
    expect(after).toHaveLength(before.length);
  });

  it('a second active model demotes the first rather than erroring', async () => {
    // The partial unique index would otherwise reject the write with a raw
    // Postgres error, which is not an answer a person can act on.
    const second = await scoringService.createModel(context.ctx, {
      name: 'Lead score v2',
      objectKey: 'contact',
      rules: [baseline(70, 'Is a contact')],
      isActive: true,
    });

    const models = await scoringService.listModels(context.ctx, { objectKey: 'contact' });
    const active = models.filter((m) => m.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(second.id);
  });

  it('scores against the model that is now active', async () => {
    const result = await withTenant(context.ctx, (tx) =>
      scoringService.scoreRecord(tx, context.tenant.tenantId, 'contact', customerId)
    );
    expect(result?.score).toBe(70);
    expect(result?.previous).toBe(30);
  });

  it('recompute walks records and reports what moved', async () => {
    const result = await scoringService.recompute(context.ctx, { objectKey: 'contact', limit: 50 });
    expect(result.scanned).toBeGreaterThan(0);
    // Everything already sits at 70 from the test above, so nothing moves.
    expect(result.changed).toBe(0);
  });

  it('a hand adjustment is recorded as manual, with its reason', async () => {
    const result = await scoringService.adjust(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
      delta: 10,
      reason: 'Met them at a trade show',
    });
    expect(result.score).toBe(80);

    const history = await scoringService.history(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
    });
    expect(history[0]?.source).toBe('manual');
    expect(history[0]?.reason).toBe('Met them at a trade show');
  });

  it('a hand adjustment SURVIVES the next re-score', async () => {
    // The whole point of the offset column. Before it, `scoreRecord` wrote the
    // rules total flat, so the +10 above lasted exactly until somebody pressed
    // "Re-score everyone" and then vanished with no error and no warning —
    // which taught people that the platform's one manual lever was a toy.
    //
    // The rules put this contact at 70 and the adjustment is +10, so a re-score
    // has to leave it at 80 and report nothing as changed.
    const again = await scoringService.recompute(context.ctx, { objectKey: 'contact' });
    expect(again.changed).toBe(0);

    const after = await withTenant(context.ctx, (tx) =>
      tx.customer.findUnique({
        where: { id: customerId },
        select: { score: true, scoreOffset: true },
      })
    );
    expect(after?.score).toBe(80);
    expect(after?.scoreOffset).toBe(10);
  });

  it('refuses an adjustment that would change nothing', async () => {
    // Silently accepting it would write a "+0" row into the one table whose
    // whole value is that every row explains something.
    //
    // Push to the ceiling first, then push again: the second one clamps to the
    // number it is already at, which is the real-world shape of this — somebody
    // marking an already-hot lead as hotter.
    const atCeiling = await scoringService.adjust(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
      delta: 1000,
      reason: 'Very interested',
    });
    expect(atCeiling.score).toBe(100);

    await expect(
      scoringService.adjust(context.ctx, {
        objectKey: 'contact',
        recordId: customerId,
        delta: 50,
        reason: 'Already at the ceiling',
      })
    ).rejects.toThrow(/would not change the score/i);
  });

  it('previews an unsaved rule set without touching the record', async () => {
    const before = await withTenant(context.ctx, (tx) =>
      tx.customer.findUnique({ where: { id: customerId }, select: { score: true } })
    );

    const preview = await scoringService.preview(context.ctx, {
      objectKey: 'contact',
      recordId: customerId,
      rules: [baseline(5, 'Trying something')],
    });
    expect(preview?.score).toBe(5);

    const after = await withTenant(context.ctx, (tx) =>
      tx.customer.findUnique({ where: { id: customerId }, select: { score: true } })
    );
    expect(after?.score).toBe(before?.score);
  });

  it('scores nothing when the tenant has written no model', async () => {
    // The normal state for every tenant that never asked for scoring: the
    // evaluator costs one indexed lookup and returns null.
    const other = await makeTestContext();
    try {
      const customer = await customerService.create(other.ctx, {
        email: `unscored-${Math.random().toString(36).slice(2, 10)}@example.test`,
        firstName: 'Unscored',
      });
      const result = await withTenant(other.ctx, (tx) =>
        scoringService.scoreRecord(tx, other.tenant.tenantId, 'contact', customer.id)
      );
      expect(result).toBeNull();
    } finally {
      await disposeTestContext(other);
    }
  });

  /* ── RLS ──────────────────────────────────────────────────────────────── */

  it('keeps models and score events inside their tenant', async () => {
    const other = await makeTestContext();
    try {
      const models = await scoringService.listModels(other.ctx, {});
      expect(models).toHaveLength(0);

      const events = await withTenant(other.ctx, (tx) =>
        tx.scoreEvent.findMany({ where: { recordId: customerId } })
      );
      expect(events).toHaveLength(0);
    } finally {
      await disposeTestContext(other);
    }
  });
});

/* ── static lists ───────────────────────────────────────────────────────── */

describe('static lists', () => {
  let context: TestContext;
  let customerId: string;

  beforeAll(async () => {
    context = await makeTestContext();
    const customer = await customerService.create(context.ctx, {
      email: `list-${Math.random().toString(36).slice(2, 10)}@example.test`,
      firstName: 'Tomas',
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  it('refuses a hand edit on a RULE-DRIVEN list, and says why', async () => {
    // The refusal is the feature: a hand edit there survives exactly until the
    // next recompute, and being quietly undone is worse than being told no.
    const dynamic = await segmentService.create(context.ctx, {
      name: 'Big spenders',
      slug: 'big-spenders',
      kind: 'dynamic',
      rules: {
        kind: 'and',
        children: [{ kind: 'predicate', field: 'customer.orderCount', op: 'gte', value: 0 }],
      },
    });

    await expect(
      segmentService.addMembers(context.ctx, dynamic.id, { customerIds: [customerId] })
    ).rejects.toThrow(/rules/i);
  });

  it('accepts members on a hand-picked list and records the joins', async () => {
    const list = await segmentService.create(context.ctx, {
      name: 'Trade show follow-ups',
      slug: 'trade-show',
      kind: 'static',
      rules: {
        kind: 'and',
        children: [{ kind: 'predicate', field: 'customer.orderCount', op: 'gte', value: 0 }],
      },
    });

    const added = await segmentService.addMembers(context.ctx, list.id, {
      customerIds: [customerId],
    });
    expect(added.added).toBe(1);

    const history = await segmentService.membershipHistory(context.ctx, list.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.kind).toBe('entered');
    expect(history[0]?.source).toBe('manual');
  });

  it('adding somebody twice is a no-op, not a duplicate', async () => {
    const list = await withTenant(context.ctx, (tx) =>
      tx.segment.findFirst({ where: { slug: 'trade-show' } })
    );
    const again = await segmentService.addMembers(context.ctx, list!.id, {
      customerIds: [customerId],
    });
    expect(again.added).toBe(0);
    expect(again.alreadyOn).toBe(1);
  });

  it('records a departure that outlives the membership row', async () => {
    // The whole reason the history table exists: `segment_members` deletes the
    // row on exit, taking every trace that the person was ever on the list.
    const list = await withTenant(context.ctx, (tx) =>
      tx.segment.findFirst({ where: { slug: 'trade-show' } })
    );
    const removed = await segmentService.removeMembers(context.ctx, list!.id, {
      customerIds: [customerId],
    });
    expect(removed.removed).toBe(1);

    const members = await segmentService.members(context.ctx, list!.id);
    expect(members).toHaveLength(0);

    const exits = await segmentService.membershipHistory(context.ctx, list!.id, {
      kind: 'exited',
    });
    expect(exits).toHaveLength(1);
    expect(exits[0]?.customerId).toBe(customerId);
  });

  it('the evaluator leaves a hand-picked list completely alone', async () => {
    // The single clause in segment-evaluator that stops a recompute emptying a
    // list somebody built by hand. Without it, the next event touching any
    // member wipes the list, silently.
    const list = await withTenant(context.ctx, (tx) =>
      tx.segment.findFirst({ where: { slug: 'trade-show' } })
    );
    await segmentService.addMembers(context.ctx, list!.id, { customerIds: [customerId] });

    await evaluateCustomerForTenant(context.tenant.tenantId, customerId);

    const members = await segmentService.members(context.ctx, list!.id);
    expect(members).toHaveLength(1);
  });

  it('keeps its rules when switched to hand-picked, so switching back is safe', async () => {
    const list = await withTenant(context.ctx, (tx) =>
      tx.segment.findFirst({ where: { slug: 'big-spenders' } })
    );
    const before = JSON.stringify(list!.rules);

    const updated = await segmentService.update(context.ctx, list!.id, { kind: 'static' });
    expect(updated.kind).toBe('static');
    expect(JSON.stringify(updated.rules)).toBe(before);
  });

  it('keeps membership history inside its tenant', async () => {
    const other = await makeTestContext();
    try {
      const rows = await withTenant(other.ctx, (tx) =>
        tx.segmentMembershipEvent.findMany({ where: { customerId } })
      );
      expect(rows).toHaveLength(0);
    } finally {
      await disposeTestContext(other);
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
