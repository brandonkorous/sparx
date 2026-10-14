// What "Search everything" finds for the things an owner names on a screen of
// their own (persona issue 261).
//
// MEASURED 2026-10-13: an owner typed "Monday" with a board called "Monday
// numbers" and was told "Nothing in your records matches". Boards, reports and
// requests had a heading in the box and nothing ever put one in the index; record
// types, shelves, price lists, booking rules and two dozen more had neither.
//
// Each hit here must (1) carry the owner's own name as its title, (2) say
// something NEW under it, and (3) open its own screen: the stored address is fed
// through the same `recordDestination` the search box uses.

import { recordDestination, routeForEntity } from '@wizeworks/links';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

/** One fake table per model: `findFirst` answers by `where`, and records the
 *  last query so a test can read how it asked. */
const tables: Record<string, Row[]> = {};
const asked: Record<string, unknown> = {};

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, want]) => {
    if (want === null) return row[key] === null || row[key] === undefined;
    if (typeof want === 'object') return true; // relation filters: not modeled here
    return row[key] === want;
  });
}

const tx = new Proxy(
  {},
  {
    get: (_target, model: string) => ({
      findFirst: (args: { where?: Row }) => {
        asked[model] = args;
        return Promise.resolve(
          (tables[model] ?? []).find((row) => matches(row, args.where)) ?? null
        );
      },
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
const BOARD = '3c1d4b8e-0f7f-4a52-9d0a-5e6f7a8b9c01';
const REPORT = '9d0a5e6f-7a8b-4c01-8f7f-0f7f8a523c1d';
const TICKET = '5e6f7a8b-9c01-4f7f-8a52-3c1d4b8e9d0a';
const RECORD = '7a8b9c01-0f7f-4a52-9c1d-4b8e9d0a5e6f';
const SHELF = '4b8e9d0a-5e6f-47a8-b9c0-10f7f8a523c1';
const TIER = '8a523c1d-4b8e-4d0a-9e6f-7a8b9c010f7f';
const HOOK = '0f7f8a52-9c01-4b8e-8d0a-5e6f7a8b3c1d';

async function find(entityType: string, recordId: string) {
  const projector = ownerNamedUniversalProjectors.find((p) => p.entityType === entityType);
  if (!projector) throw new Error(`no ${entityType} projector`);
  return projector.project(ctx, recordId);
}

/** The screen a hit opens, read the way the search box reads it. */
function opens(doc: { entity_type: string; record_id: string; url?: string }) {
  return recordDestination(doc.entity_type, doc.record_id, doc.url);
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
});

describe('a board, found by its name', () => {
  it('is found as "Monday numbers" and opens that board', async () => {
    tables.crmDashboard = [
      {
        id: BOARD,
        name: 'Monday numbers',
        description: null,
        isDefault: false,
        ownerId: null,
        shared: true,
        archivedAt: null,
        createdAt: AT,
        updatedAt: AT,
        widgets: [
          { title: null, report: { name: 'Deals by stage', ownerId: null, shared: true } },
          {
            title: 'Requests this week',
            report: { name: 'Requests opened each week', ownerId: null, shared: true },
          },
        ],
      },
    ];
    const doc = await find('dashboard', BOARD);
    expect(doc).toMatchObject({
      entity_type: 'dashboard',
      module: 'crm',
      title: 'Monday numbers',
      // What is on it, in the words its cards show.
      subtitle: 'Shows Deals by stage and Requests this week',
    });
    expect(doc && opens(doc)).toEqual({
      surface: 'crm.dashboard.detail',
      params: { id: BOARD },
    });
  });

  it('leaves search once it is put away', async () => {
    tables.crmDashboard = [{ id: BOARD, name: 'Old board', archivedAt: AT }];
    expect(await find('dashboard', BOARD)).toBe(null);
  });
});

describe('a report', () => {
  it('says what it counts, in the name the owner gave that kind of record', async () => {
    tables.crmReport = [
      {
        id: REPORT,
        name: 'Courses that filled',
        description: null,
        objectKey: 'course',
        ownerId: null,
        shared: true,
        archivedAt: null,
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    tables.crmObjectDef = [{ key: 'course', labelPlural: 'Courses' }];
    const doc = await find('report', REPORT);
    expect(doc).toMatchObject({
      title: 'Courses that filled',
      subtitle: 'A report on your courses',
    });
    expect(doc && opens(doc)).toEqual({ surface: 'crm.report.builder', params: { id: REPORT } });
  });
});

describe('a request', () => {
  it('is found by its number either way it is written, and says who asked', async () => {
    tables.ticket = [
      {
        id: TICKET,
        number: 42,
        subject: 'Order arrived damaged',
        description: null,
        tags: [],
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT,
        company: { companyName: 'Harbor Light Bakery' },
        customer: null,
        stage: { name: 'New', stageType: 'open' },
      },
    ];
    const doc = await find('ticket', TICKET);
    expect(doc).toMatchObject({
      title: 'Order arrived damaged',
      subtitle: '#42 from Harbor Light Bakery',
      status: 'open',
    });
    expect(doc?.keywords).toEqual(expect.arrayContaining(['#42', '42']));
    expect(doc && opens(doc)).toEqual({ surface: 'crm.ticket.detail', params: { id: TICKET } });
  });
});

describe('a record type and a record of one', () => {
  it('keys a record type by its key, so it opens the screen addressed by key', async () => {
    tables.crmObjectDef = [
      {
        key: 'course',
        kind: 'custom',
        label: 'Course',
        labelPlural: 'Courses',
        description: null,
        archivedAt: null,
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    const doc = await find('crm_object_type', 'course');
    expect(doc).toMatchObject({
      record_id: 'course',
      title: 'Courses',
      subtitle: 'A kind of record you added',
    });
    expect(doc && opens(doc)).toEqual({
      surface: 'crm.object-type.detail',
      params: { key: 'course' },
    });
  });

  it('opens a record of a made-up type with both halves of its address', async () => {
    tables.crmRecord = [
      {
        id: RECORD,
        objectKey: 'course',
        title: 'Spring pottery cohort',
        values: { title: 'Spring pottery cohort', teacher: 'Ines Okafor', seats: 12 },
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT,
        objectDef: { label: 'Course' },
      },
    ];
    const doc = await find('crm_record', RECORD);
    expect(doc).toMatchObject({ title: 'Spring pottery cohort', subtitle: 'Course' });
    expect(doc?.keywords).toContain('Ines Okafor');
    expect(doc && opens(doc)).toEqual({
      surface: 'crm.record.detail',
      params: { objectKey: 'course', id: RECORD },
    });
  });
});

describe('a shelf', () => {
  it('is titled by the code on its label when it has no name, and says where it is', async () => {
    tables.inventoryBin = [
      {
        id: SHELF,
        code: 'A-01-03',
        name: null,
        zone: 'Front',
        aisle: null,
        rack: null,
        shelf: null,
        notes: null,
        isActive: true,
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT,
        warehouse: { name: 'Back room' },
      },
    ];
    const doc = await find('bin', SHELF);
    expect(doc).toMatchObject({ title: 'A-01-03', subtitle: 'At Back room', module: 'inventory' });
    expect(doc && opens(doc)).toEqual({ surface: 'inventory.bins.detail', params: { id: SHELF } });
  });
});

describe('a product type', () => {
  it('asks for the tenant’s own copy of a built-in before the shipped one', async () => {
    tables.productType = [
      {
        key: 'apparel',
        name: 'Clothing',
        pluralName: 'Clothing',
        description: null,
        isBuiltIn: false,
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    const doc = await find('product_type', 'apparel');
    expect(asked.productType).toMatchObject({
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    });
    expect(doc).toMatchObject({ record_id: 'apparel', title: 'Clothing' });
    expect(doc && opens(doc)).toEqual({
      surface: 'commerce.product-types.detail',
      params: { key: 'apparel' },
    });
  });
});

describe('a wholesale price tier', () => {
  it('says the discount, not the database’s word for its kind', async () => {
    tables.b2bPricingTier = [
      {
        id: TIER,
        name: 'Contractor',
        description: null,
        discountType: 'percentage',
        discountValue: { toString: () => '12.5000' },
        deletedAt: null,
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    expect(await find('pricing_tier', TIER)).toMatchObject({
      title: 'Contractor',
      subtitle: '12.5% off',
      module: 'b2b',
    });
  });
});

describe('a webhook', () => {
  it('names where it sends by host only, and never reads the secret', async () => {
    tables.webhookSubscription = [
      {
        id: HOOK,
        name: 'Order feed',
        url: 'https://hooks.example.com/in/abc123?token=s3cret',
        active: true,
        createdAt: AT,
        updatedAt: AT,
      },
    ];
    const doc = await find('webhook', HOOK);
    expect(doc).toMatchObject({ subtitle: 'Sends to hooks.example.com', status: 'active' });
    expect(JSON.stringify(doc)).not.toContain('s3cret');
    expect(asked.webhookSubscription).toMatchObject({ select: { name: true, url: true } });
    expect(asked.webhookSubscription).not.toMatchObject({ select: { signingSecret: true } });
  });
});

/** Every kind issue 261 listed, by its search entity type. */
const LISTED = [
  'report',
  'dashboard',
  'ticket',
  'crm_object_type',
  'crm_record',
  'bin',
  'count_schedule',
  'bom',
  'po_approval_rule',
  'report_schedule',
  'inventory_source',
  'price_list',
  'markup_rule',
  'shipping_profile',
  'shipping_zone',
  'fitment_domain',
  'configurator_template',
  'product_type',
  'pricing_tier',
  'scheduling_service',
  'scheduling_resource',
  'scheduling_location',
  'booking_policy',
  'content_type',
  'taxonomy',
  'webhook',
  'billing_template',
  'document_workflow',
  'funnel',
  'ai_prompt',
  'staff_member',
  'dropship_supplier',
  'builder_component',
];

describe('every kind an owner names', () => {
  it('has a projector, every one the issue listed', () => {
    expect(ownerNamedUniversalProjectors.map((p) => p.entityType).sort()).toEqual(
      [...LISTED].sort()
    );
  });

  it('has a home in the route table, so a hit is never a dead row', () => {
    expect(ownerNamedUniversalProjectors.length).toBe(LISTED.length);
    for (const projector of ownerNamedUniversalProjectors) {
      expect(routeForEntity(projector.entityType), projector.entityType).toBeDefined();
    }
  });
});
