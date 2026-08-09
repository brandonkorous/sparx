// reportService + dashboardService against the real schema (docs/144 §8).
//
// The compiler's own logic is tested purely in `src/services/report-compiler.test.ts`.
// What this file holds is everything that only exists once the database is
// involved:
//
//   • THE COMPILED SQL ACTUALLY RUNS. A compiler that emits plausible SQL is
//     worth nothing until Postgres has accepted it against the real columns —
//     which is the one thing a unit test on a string cannot tell you.
//   • RLS IS THE REAL FENCE. `$queryRawUnsafe` bypasses Prisma's own scoping, so
//     a report run in one tenant must not see another's rows.
//   • THE BUILT-INS ARE SEEDED AND READ-ONLY, and duplicating one produces a row
//     the tenant owns outright.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customerService,
  dashboardService,
  reportCompiler,
  reportService,
  seedBuiltinReports,
  BUILTIN_REPORTS,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

describe('reportService', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await makeTestContext();
    // Something to count.
    for (const company of ['Acme', 'Acme', 'Globex']) {
      await customerService.create(context.ctx, {
        email: `r-${Math.random().toString(36).slice(2, 10)}@example.test`,
        firstName: 'Dana',
        company,
      });
    }
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  /* ── The SQL runs ─────────────────────────────────────────────────────── */

  it('runs an ungrouped count against the real table', async () => {
    const result = await reportService.preview(context.ctx, {
      name: 'How many customers',
      objectKey: 'contact',
      measures: [{ fn: 'count' }],
      visualization: 'number',
    });
    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0]?.m0)).toBeGreaterThanOrEqual(3);
  });

  it('runs a grouped count and orders it biggest-first', async () => {
    const result = await reportService.preview(context.ctx, {
      name: 'Customers by company',
      objectKey: 'contact',
      groupBy: { field: 'company' },
      measures: [{ fn: 'count' }],
      visualization: 'bar',
    });
    expect(result.grouped).toBe(true);
    const us = result.rows.find((row) => row.g0 === 'Acme');
    expect(Number(us?.m0)).toBe(2);
    // Biggest first is what somebody scanning a breakdown is looking for.
    const counts = result.rows.map((row) => Number(row.m0));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('runs a date-bucketed report', async () => {
    // DATE_TRUNC over a timestamptz column is the clause most likely to be
    // rejected by Postgres if the compiler names the column wrongly.
    const result = await reportService.preview(context.ctx, {
      name: 'New customers by month',
      objectKey: 'contact',
      groupBy: { field: 'createdAt', bucket: 'month' },
      measures: [{ fn: 'count' }],
      visualization: 'line',
    });
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('runs every built-in definition without error', async () => {
    // The built-ins are the worked examples. One that throws teaches a person
    // that the builder is broken, on their first ever look at it.
    for (const builtin of BUILTIN_REPORTS) {
      await expect(
        reportService.preview(context.ctx, {
          name: builtin.name,
          objectKey: builtin.objectKey,
          filters: builtin.filters,
          groupBy: builtin.groupBy,
          measures: builtin.measures,
          visualization: builtin.visualization,
          dateRange: builtin.dateRange,
        })
      ).resolves.toBeDefined();
    }
  });

  it('every field the builder offers actually exists in the database', async () => {
    // THE TEST THAT SHOULD HAVE EXISTED FIRST. The compiler's column map is
    // hand-written, and a name that is merely plausible — `country` on a
    // customer, `assigned_to_id` on a task — compiles into perfectly valid SQL
    // and fails only when Postgres sees it. Since the builder's field picker is
    // fed from that same map, a wrong entry is a field a person can choose and
    // then be told does not exist.
    //
    // So: run every offered field, on every offered object, against the real
    // schema. A unit test on the emitted string cannot do this.
    for (const object of reportCompiler.reportableObjects()) {
      for (const field of reportCompiler.reportableFields(object.objectKey)) {
        await expect(
          reportService.preview(context.ctx, {
            name: `${object.objectKey}.${field.path}`,
            objectKey: object.objectKey,
            groupBy: { field: field.path },
            measures: [{ fn: 'count' }],
            visualization: 'table',
          }),
          `${object.objectKey}.${field.path} should be queryable`
        ).resolves.toBeDefined();
      }
    }
  });

  /* ── RLS ──────────────────────────────────────────────────────────────── */

  it('cannot see another tenant’s rows', async () => {
    const other = await makeTestContext();
    try {
      await customerService.create(other.ctx, {
        email: `other-${Math.random().toString(36).slice(2, 10)}@example.test`,
        firstName: 'Elsewhere',
        company: 'ZZ-Only-Elsewhere',
      });

      const result = await reportService.preview(context.ctx, {
        name: 'Customers by company',
        objectKey: 'contact',
        groupBy: { field: 'company' },
        measures: [{ fn: 'count' }],
        visualization: 'bar',
      });
      // `$queryRawUnsafe` goes around Prisma's own scoping, so this is the
      // assertion that the RLS policy — not the ORM — is what fences a report.
      expect(result.rows.some((row) => row.g0 === 'ZZ-Only-Elsewhere')).toBe(false);
    } finally {
      await disposeTestContext(other);
    }
  });

  /* ── Saved definitions ────────────────────────────────────────────────── */

  it('saves, runs and archives a report', async () => {
    const saved = await reportService.create(context.ctx, {
      name: 'My customers by company',
      objectKey: 'contact',
      groupBy: { field: 'company' },
      measures: [{ fn: 'count' }],
      visualization: 'bar',
    });
    const run = await reportService.run(context.ctx, saved.id);
    expect(run.report.id).toBe(saved.id);
    expect(run.rows.length).toBeGreaterThan(0);

    await reportService.archive(context.ctx, saved.id);
    const remaining = await reportService.list(context.ctx);
    expect(remaining.some((r) => r.id === saved.id)).toBe(false);
  });

  it('refuses a chart the definition cannot draw', async () => {
    // A pie chart of an ungrouped count is one wedge covering 100% of itself:
    // it looks like a working chart and says nothing.
    await expect(
      reportService.create(context.ctx, {
        name: 'Nonsense',
        objectKey: 'contact',
        measures: [{ fn: 'count' }],
        visualization: 'pie',
      })
    ).rejects.toThrow();
  });

  it('leaves a patch that never mentioned filters alone', async () => {
    const saved = await reportService.create(context.ctx, {
      name: 'Filtered',
      objectKey: 'contact',
      filters: { logic: 'AND', conditions: [{ field: 'company', operator: 'eq', value: 'Acme' }] },
      measures: [{ fn: 'count' }],
      visualization: 'number',
    });
    // zod keeps a `.default()` through `.partial()`, so a patch touching only
    // the name would otherwise arrive carrying the empty group and silently
    // wipe the filters.
    const renamed = await reportService.update(context.ctx, saved.id, { name: 'Renamed' });
    expect(renamed.name).toBe('Renamed');
    expect(JSON.stringify(renamed.filters)).toContain('company');
  });

  /* ── Built-ins ────────────────────────────────────────────────────────── */

  it('seeds the built-ins once, and refuses to edit one in place', async () => {
    await seedBuiltinReports(context.ctx);
    const again = await seedBuiltinReports(context.ctx);
    expect(again).toBe(0);

    const all = await reportService.list(context.ctx);
    const builtin = all.find((r) => r.builtinSlug);
    expect(builtin).toBeDefined();

    // Editing the shipped one would make "what sparx sends" mean something
    // different per tenant, and lose the example nobody could get back.
    await expect(
      reportService.update(context.ctx, builtin?.id ?? '', { name: 'Mine now' })
    ).rejects.toThrow();
    await expect(reportService.archive(context.ctx, builtin?.id ?? '')).rejects.toThrow();
  });

  it('duplicating a built-in yields a report the tenant owns outright', async () => {
    await seedBuiltinReports(context.ctx);
    const all = await reportService.list(context.ctx);
    const builtin = all.find((r) => r.builtinSlug);
    const copy = await reportService.duplicate(context.ctx, builtin?.id ?? '');

    expect(copy.builtinSlug).toBeNull();
    expect(copy.name).toContain('(copy)');
    // And it is editable, which is the entire point of the copy.
    const edited = await reportService.update(context.ctx, copy.id, { name: 'Mine' });
    expect(edited.name).toBe('Mine');
  });
});

describe('dashboardService', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await makeTestContext();
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  it('replaces the whole layout in one write', async () => {
    const board = await dashboardService.create(context.ctx, { name: 'How we are doing' });
    const a = await reportService.create(context.ctx, {
      name: 'A',
      objectKey: 'contact',
      measures: [{ fn: 'count' }],
      visualization: 'number',
    });
    const b = await reportService.create(context.ctx, {
      name: 'B',
      objectKey: 'deal',
      measures: [{ fn: 'count' }],
      visualization: 'number',
    });

    const withTwo = await dashboardService.setWidgets(context.ctx, board.id, {
      widgets: [
        { reportId: a.id, x: 0, y: 0, w: 6, h: 4 },
        { reportId: b.id, x: 6, y: 0, w: 6, h: 4 },
      ],
    });
    expect(withTwo.widgets).toHaveLength(2);

    // A board is only ever valid as a SET — dropping one widget on a grid moves
    // its neighbours, so the layout is written whole or not at all.
    const withOne = await dashboardService.setWidgets(context.ctx, board.id, {
      widgets: [{ reportId: b.id, x: 0, y: 0, w: 12, h: 4 }],
    });
    expect(withOne.widgets).toHaveLength(1);
    expect(withOne.widgets[0]?.w).toBe(12);
  });

  it('refuses a widget pointing at a report that is gone', async () => {
    const board = await dashboardService.create(context.ctx, { name: 'Board' });
    const doomed = await reportService.create(context.ctx, {
      name: 'Doomed',
      objectKey: 'contact',
      measures: [{ fn: 'count' }],
      visualization: 'number',
    });
    await reportService.archive(context.ctx, doomed.id);

    await expect(
      dashboardService.setWidgets(context.ctx, board.id, {
        widgets: [{ reportId: doomed.id, x: 0, y: 0, w: 6, h: 4 }],
      })
    ).rejects.toThrow();
  });

  it('moves the default flag rather than colliding with it', async () => {
    const first = await dashboardService.create(context.ctx, {
      name: 'First',
      isDefault: true,
    });
    // A partial unique index enforces one default per site; making a second one
    // the default has to DEMOTE the first, not error at the person.
    const second = await dashboardService.create(context.ctx, {
      name: 'Second',
      isDefault: true,
    });

    const landing = await dashboardService.landing(context.ctx);
    expect(landing?.id).toBe(second.id);

    const all = await dashboardService.list(context.ctx);
    expect(all.find((d) => d.id === first.id)?.isDefault).toBe(false);
  });

  it('frees the default slot when the landing board is archived', async () => {
    const board = await dashboardService.create(context.ctx, {
      name: 'Temporary',
      isDefault: true,
    });
    await dashboardService.archive(context.ctx, board.id);
    // Otherwise the partial index stays occupied by an archived row and no
    // other board can ever become the landing page.
    const replacement = await dashboardService.create(context.ctx, {
      name: 'Replacement',
      isDefault: true,
    });
    expect(replacement.isDefault).toBe(true);
  });
});
