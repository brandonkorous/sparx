// Search finds a board or report kept to its maker for her alone (persona issue
// 264).
//
// Issue 261 put every board and report in the index, so a board Doty kept to
// himself came up when Mike typed its name, and a shared board was found by the
// name of a private report on it. Each document now says who may find it, and a
// board is found only by the names of the cards everybody who can open it sees.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, want]) => {
    if (want === null) return row[key] === null || row[key] === undefined;
    if (typeof want === 'object') return true;
    return row[key] === want;
  });
}

const tx = new Proxy(
  {},
  {
    get: (_target, model: string) => ({
      findFirst: (args: { where?: Row }) =>
        Promise.resolve((tables[model] ?? []).find((row) => matches(row, args.where)) ?? null),
      findMany: () => Promise.resolve(tables[model] ?? []),
    }),
  }
);

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { ownerNamedUniversalProjectors } = await import('./universal-projection-owner-named');

const ctx = { tenantId: 'tenant-1' };
const AT = new Date('2026-10-13T09:00:00Z');
const DOTY = '0d07a000-0000-4000-8000-000000000001';
const BOARD = '3c1d4b8e-0f7f-4a52-9d0a-5e6f7a8b9c01';
const REPORT = '9d0a5e6f-7a8b-4c01-8f7f-0f7f8a523c1d';

async function find(entityType: string, recordId: string) {
  const projector = ownerNamedUniversalProjectors.find((p) => p.entityType === entityType);
  if (!projector) throw new Error(`no ${entityType} projector`);
  return projector.project(ctx, recordId);
}

const report = (ownerId: string | null, shared: boolean): Row => ({
  id: REPORT,
  name: 'Commission by rep',
  description: null,
  objectKey: 'deal',
  ownerId,
  shared,
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
});

const board = (shared: boolean, cards: Row[]): Row => ({
  id: BOARD,
  name: 'Monday numbers',
  description: null,
  isDefault: false,
  ownerId: DOTY,
  shared,
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  widgets: cards,
});

const card = (name: string, title: string | null, ownerId: string | null, shared: boolean) => ({
  title,
  report: { name, ownerId, shared },
});

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
});

describe('a report in search', () => {
  it('kept to its maker is found by her alone', async () => {
    tables.crmReport = [report(DOTY, false)];
    expect(await find('report', REPORT)).toMatchObject({ visible_to: [DOTY] });
  });

  it('shared, or made by nobody, is found by everyone', async () => {
    tables.crmReport = [report(DOTY, true)];
    expect(await find('report', REPORT)).toMatchObject({ visible_to: ['everyone'] });
    tables.crmReport = [report(null, false)];
    expect(await find('report', REPORT)).toMatchObject({ visible_to: ['everyone'] });
  });
});

describe('a board in search', () => {
  it('kept to its maker is found by her alone, by every card on it', async () => {
    tables.crmDashboard = [
      board(false, [card('Commission by rep', 'Who earned what', DOTY, false)]),
    ];
    const doc = await find('dashboard', BOARD);
    expect(doc).toMatchObject({ visible_to: [DOTY], subtitle: 'Shows Who earned what' });
  });

  it('shared, is found by everyone, and never by a private card’s name', async () => {
    tables.crmDashboard = [
      board(true, [
        card('Commission by rep', 'Who earned what', DOTY, false),
        card('Deals by stage', null, null, true),
      ]),
    ];
    const doc = await find('dashboard', BOARD);
    expect(doc).toMatchObject({ visible_to: ['everyone'], subtitle: 'Shows Deals by stage' });
    const words = JSON.stringify(doc);
    expect(words).not.toContain('Commission by rep');
    expect(words).not.toContain('Who earned what');
  });
});
