import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A BOARD OR REPORT KEPT TO YOURSELF IS KEPT TO YOU (persona issue 264).
 *
 * The new-board form says "Everyone can open it. Off keeps it to you." Boards and
 * reports stored who made them and whether they were shared, and nothing read
 * either: every teammate listed, opened, ran, changed and deleted every one. These
 * tests drive the services against an in-memory table that applies the `where`
 * each service sends, so a service that forgets the rule shows every row.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

/** The slice of Prisma's `where` grammar these two services use. */
function matches(row: Row | null | undefined, where: Where | undefined): boolean {
  if (!where) return true;
  if (!row) return false;
  return Object.entries(where).every(([key, want]) => {
    if (key === 'OR') return (want as Where[]).some((w) => matches(row, w));
    if (key === 'AND') return (want as Where[]).every((w) => matches(row, w));
    const value = row[key];
    if (want === null) return value === null || value === undefined;
    if (want instanceof Date || typeof want !== 'object') return value === want;
    const op = want as { in?: unknown[]; not?: unknown };
    if ('in' in op) return (op.in ?? []).includes(value);
    if ('not' in op) return value !== op.not;
    return matches(value as Row, want as Where);
  });
}

const DOTY = '0d07a000-0000-4000-8000-000000000001';
const MIKE = '0d07a000-0000-4000-8000-000000000002';
const TENANT = '0d07a000-0000-4000-8000-0000000000aa';

const PRIVATE_BOARD = 'b0a7d000-0000-4000-8000-000000000001';
const TEAM_BOARD = 'b0a7d000-0000-4000-8000-000000000002';
const MIKE_BOARD = 'b0a7d000-0000-4000-8000-000000000003';

const PRIVATE_REPORT = 'a0e70000-0000-4000-8000-000000000001';
const READY_MADE = 'a0e70000-0000-4000-8000-000000000002';
const OLD_REPORT = 'a0e70000-0000-4000-8000-000000000003';
const OTHER_PRIVATE = 'a0e70000-0000-4000-8000-000000000004';

let dashboards: Row[];
let reports: Row[];
let widgets: Row[];

function report(id: string, name: string, ownerId: string | null, shared: boolean): Row {
  return {
    id,
    tenantId: TENANT,
    propertyId: null,
    name,
    description: `${name}, written up`,
    objectKey: 'deal',
    filters: { op: 'and', conditions: [] },
    groupBy: null,
    measures: [{ fn: 'count' }],
    visualization: 'number',
    dateRange: { kind: 'all' },
    builtinSlug: ownerId === null && shared ? 'deals_by_stage' : null,
    ownerId,
    shared,
    archivedAt: null,
  };
}

function board(id: string, name: string, ownerId: string, shared: boolean, isDefault = false): Row {
  return {
    id,
    tenantId: TENANT,
    propertyId: null,
    name,
    description: null,
    isDefault,
    ownerId,
    shared,
    archivedAt: null,
  };
}

const withReport = (w: Row): Row => ({ ...w, report: reports.find((r) => r.id === w.reportId) });

const tx = {
  crmDashboard: {
    findMany: vi.fn((args: { where?: Where; select?: Row }) =>
      Promise.resolve(
        dashboards
          .filter((d) => matches(d, args.where))
          .sort(
            (a, b) =>
              Number(b.isDefault) - Number(a.isDefault) ||
              String(a.name).localeCompare(String(b.name))
          )
      )
    ),
    findFirst: vi.fn((args: { where?: Where }) => {
      const d = dashboards.find((row) => matches(row, args.where));
      if (!d) return Promise.resolve(null);
      return Promise.resolve({
        ...d,
        widgets: widgets.filter((w) => w.dashboardId === d.id).map(withReport),
      });
    }),
    update: vi.fn((args: { where: { id: string }; data: Row }) => {
      const d = dashboards.find((row) => row.id === args.where.id);
      Object.assign(d ?? {}, args.data);
      return Promise.resolve(d);
    }),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
  },
  crmReport: {
    findMany: vi.fn((args: { where?: Where }) =>
      Promise.resolve(reports.filter((r) => matches(r, args.where)))
    ),
    findFirst: vi.fn((args: { where?: Where }) =>
      Promise.resolve(reports.find((r) => matches(r, args.where)) ?? null)
    ),
    update: vi.fn((args: { where: { id: string }; data: Row }) => {
      const r = reports.find((row) => row.id === args.where.id);
      Object.assign(r ?? {}, args.data);
      return Promise.resolve(r);
    }),
    create: vi.fn((args: { data: Row }) => {
      const row = { id: 'a0e70000-0000-4000-8000-0000000000ff', archivedAt: null, ...args.data };
      reports.push(row);
      return Promise.resolve(row);
    }),
  },
  crmDashboardWidget: {
    findMany: vi.fn((args: { where?: Where }) =>
      Promise.resolve(widgets.filter((w) => matches(w, args.where)))
    ),
    deleteMany: vi.fn((args: { where: { dashboardId: string } }) => {
      widgets = widgets.filter((w) => w.dashboardId !== args.where.dashboardId);
      return Promise.resolve({ count: 0 });
    }),
    createMany: vi.fn((args: { data: Row[] }) => {
      args.data.forEach((w, at) => widgets.push({ id: `new-${String(at)}`, ...w }));
      return Promise.resolve({ count: args.data.length });
    }),
  },
  crmObjectDef: { findUnique: vi.fn(() => Promise.resolve(null)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));
vi.mock('@wizeworks/events', () => ({ indexEntity: vi.fn(() => Promise.resolve()) }));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('./report-compiler', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runReport: vi.fn(() =>
    Promise.resolve({ columns: [], rows: [{ count: 41 }], grouped: false, truncated: false })
  ),
}));

const boards = await import('./dashboard-service');
const saved = await import('./report-service');
const { CrmNotFoundError, CrmValidationError } = await import('../errors');

const asDoty = { tenantId: TENANT, userId: DOTY };
const asMike = { tenantId: TENANT, userId: MIKE };
const asKey = { tenantId: TENANT };

beforeEach(() => {
  vi.clearAllMocks();
  reports = [
    report(PRIVATE_REPORT, 'Commission by rep', DOTY, false),
    report(READY_MADE, 'Deals by stage', null, true),
    report(OLD_REPORT, 'Made before owners were kept', null, false),
    report(OTHER_PRIVATE, 'Doty side notes', DOTY, false),
  ];
  dashboards = [
    board(PRIVATE_BOARD, 'Aaa my numbers', DOTY, false, true),
    board(TEAM_BOARD, 'Monday numbers', DOTY, true),
    board(MIKE_BOARD, 'Weekend list', MIKE, false),
  ];
  widgets = [
    {
      id: 'w1',
      dashboardId: TEAM_BOARD,
      reportId: PRIVATE_REPORT,
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      title: 'Who earned what',
    },
    {
      id: 'w2',
      dashboardId: TEAM_BOARD,
      reportId: READY_MADE,
      x: 6,
      y: 0,
      w: 6,
      h: 4,
      title: null,
    },
  ];
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe('a board kept to its maker', () => {
  it('is in its maker’s list and nobody else’s', async () => {
    expect(ids(await boards.list(asDoty))).toEqual([PRIVATE_BOARD, TEAM_BOARD].sort());
    expect(ids(await boards.list(asMike))).toEqual([TEAM_BOARD, MIKE_BOARD].sort());
  });

  it('answers a teammate who opens it as though it did not exist', async () => {
    await expect(boards.get(asMike, PRIVATE_BOARD)).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(boards.get(asDoty, PRIVATE_BOARD)).resolves.toMatchObject({ id: PRIVATE_BOARD });
  });

  it('cannot be changed, laid out or deleted by a teammate', async () => {
    await expect(boards.update(asMike, PRIVATE_BOARD, { name: 'Mine now' })).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await expect(boards.archive(asMike, PRIVATE_BOARD)).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(boards.setWidgets(asMike, PRIVATE_BOARD, { widgets: [] })).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    expect(tx.crmDashboard.update).not.toHaveBeenCalled();
    expect(tx.crmDashboardWidget.deleteMany).not.toHaveBeenCalled();
  });

  it('can be changed and deleted by its maker', async () => {
    await expect(
      boards.update(asDoty, PRIVATE_BOARD, { name: 'Still mine' })
    ).resolves.toMatchObject({ name: 'Still mine' });
    await expect(boards.archive(asDoty, PRIVATE_BOARD)).resolves.toMatchObject({
      id: PRIVATE_BOARD,
    });
  });

  it('is not a teammate’s landing board even when it is the default', async () => {
    expect((await boards.landing(asDoty))?.id).toBe(PRIVATE_BOARD);
    // Mike lands on the first board he can see, by name.
    expect((await boards.landing(asMike))?.id).toBe(TEAM_BOARD);
  });

  it('is hidden from a caller who is not a person, like an API key', async () => {
    expect(ids(await boards.list(asKey))).toEqual([TEAM_BOARD]);
  });
});

describe('a private report on a shared board', () => {
  it('shows its maker everything', async () => {
    const seen = await boards.get(asDoty, TEAM_BOARD);
    const card = seen.widgets.find((w) => w.reportId === PRIVATE_REPORT);
    expect(card).toMatchObject({ privateReport: false, title: 'Who earned what' });
    expect(card?.report?.name).toBe('Commission by rep');
  });

  it('shows a teammate the card, without its name, words or numbers', async () => {
    const seen = await boards.get(asMike, TEAM_BOARD);
    const card = seen.widgets.find((w) => w.reportId === PRIVATE_REPORT);
    expect(card).toMatchObject({ privateReport: true, report: null, title: null });
    expect(JSON.stringify(seen)).not.toContain('Commission by rep');
    expect(JSON.stringify(seen)).not.toContain('Who earned what');
    // The ready-made one beside it is the business's, so he sees it whole.
    const other = seen.widgets.find((w) => w.reportId === READY_MADE);
    expect(other).toMatchObject({ privateReport: false, report: { name: 'Deals by stage' } });
  });

  it('survives a teammate rearranging the board, with the name its maker gave it', async () => {
    await boards.setWidgets(asMike, TEAM_BOARD, {
      widgets: [
        { reportId: PRIVATE_REPORT, x: 0, y: 4, w: 12, h: 4, title: null },
        { reportId: READY_MADE, x: 0, y: 0, w: 12, h: 4, title: null },
      ],
    });
    const kept = widgets.find((w) => w.reportId === PRIVATE_REPORT);
    expect(kept).toMatchObject({ y: 4, w: 12, title: 'Who earned what' });
  });

  it('cannot be put on a board by a teammate who cannot see it', async () => {
    await expect(
      boards.setWidgets(asMike, TEAM_BOARD, {
        widgets: [{ reportId: OTHER_PRIVATE, x: 0, y: 0, w: 6, h: 4 }],
      })
    ).rejects.toBeInstanceOf(CrmValidationError);
    expect(tx.crmDashboardWidget.deleteMany).not.toHaveBeenCalled();
  });
});

describe('a report kept to its maker', () => {
  it('is in its maker’s list and nobody else’s; the business’s own are in everyone’s', async () => {
    expect(ids(await saved.list(asDoty))).toEqual(
      [PRIVATE_REPORT, READY_MADE, OLD_REPORT, OTHER_PRIVATE].sort()
    );
    expect(ids(await saved.list(asMike))).toEqual([READY_MADE, OLD_REPORT].sort());
  });

  it('cannot be opened, run, changed, copied or deleted by a teammate', async () => {
    await expect(saved.get(asMike, PRIVATE_REPORT)).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(saved.run(asMike, PRIVATE_REPORT)).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(saved.update(asMike, PRIVATE_REPORT, { name: 'x' })).rejects.toBeInstanceOf(
      CrmNotFoundError
    );
    await expect(saved.duplicate(asMike, PRIVATE_REPORT)).rejects.toBeInstanceOf(CrmNotFoundError);
    await expect(saved.archive(asMike, PRIVATE_REPORT)).rejects.toBeInstanceOf(CrmNotFoundError);
    expect(tx.crmReport.update).not.toHaveBeenCalled();
    expect(tx.crmReport.create).not.toHaveBeenCalled();
  });

  it('runs and copies for its maker', async () => {
    await expect(saved.run(asDoty, PRIVATE_REPORT)).resolves.toMatchObject({
      rows: [{ count: 41 }],
    });
    await expect(saved.duplicate(asDoty, PRIVATE_REPORT)).resolves.toMatchObject({
      name: 'Commission by rep (copy)',
      ownerId: DOTY,
      shared: false,
    });
  });

  it('runs for a teammate once it is shared', async () => {
    await saved.update(asDoty, PRIVATE_REPORT, { shared: true });
    await expect(saved.run(asMike, PRIVATE_REPORT)).resolves.toMatchObject({
      rows: [{ count: 41 }],
    });
  });
});

// The business has ONE board Dashboards opens on, for everyone. A private board in
// that slot switched the team's shared default off for every teammate, so only a
// shared board can hold it (persona issue 264).
describe('the board Dashboards opens on', () => {
  it('cannot be a private board, made new', async () => {
    await expect(
      boards.create(asDoty, { name: 'Just mine', isDefault: true, shared: false })
    ).rejects.toBeInstanceOf(CrmValidationError);
  });

  it('cannot be given to a private board', async () => {
    await expect(boards.update(asMike, MIKE_BOARD, { isDefault: true })).rejects.toBeInstanceOf(
      CrmValidationError
    );
  });

  it('cannot be made private while it is the one', async () => {
    dashboards = dashboards.map((d) => (d.id === TEAM_BOARD ? { ...d, isDefault: true } : d));
    await expect(boards.update(asDoty, TEAM_BOARD, { shared: false })).rejects.toBeInstanceOf(
      CrmValidationError
    );
  });

  it('can be a shared board', async () => {
    await expect(boards.update(asDoty, TEAM_BOARD, { isDefault: true })).resolves.toMatchObject({
      id: TEAM_BOARD,
    });
  });
});
