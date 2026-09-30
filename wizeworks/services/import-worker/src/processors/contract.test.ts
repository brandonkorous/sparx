import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_ENTITIES,
  ENTITY_FIELDS,
  type CanonicalEntity,
  type FieldSpec,
} from '@wizeworks/migration';

// THE IMPORT CONTRACT, MEASURED.
//
// `ENTITY_FIELDS` in @wizeworks/migration is what the Move-in column mapper offers a
// tenant for each entity; the processors in this folder are what save the rows. The
// two drifted apart silently, entity after entity: discounts were offered as `code`,
// `title`, `value`, `starts_at` while the processor read `name`, `value_cents`,
// `start_at`, so every discount failed "name is required"; products, stock levels,
// categories, collections, media, deals, tickets, suppliers and purchase orders each
// offered columns nothing read, so the mapper showed them as mapped and the values
// vanished. Each side's own tests were green the whole time.
//
// So this does not compare two declared lists, which can both be wrong. It MEASURES:
// every row handed to a processor is a proxy that records which columns the processor
// actually looked at, and the processor is run against a fake database in the worlds
// that reach its branches (nothing exists yet; everything already exists). The keys
// it read must be exactly the keys Move in offers:
//
//   offered and never read  -> data the tenant watches import and never sees again
//   read and never offered  -> a column no tenant can ever map
//
// Each processor is run on one row carrying every offered field, and then once per
// field on a row carrying only that field plus the required ones, because a fallback
// column (`weight_kg` behind `weight_grams`) is only read when the first is absent.

const worldState = vi.hoisted(() => ({
  /** Model names whose `findFirst` answers with a record. `'*'` means every model. */
  found: new Set<string>(),
}));

/** One value that satisfies every shape a processor might read back from a fake:
 *  iterable (a list result), with an id (a created record), and with the handful of
 *  nested fields processors dig into. */
const record = vi.hoisted(
  () => (): unknown =>
    Object.assign([], {
      id: 'record-1',
      productId: 'product-1',
      name: 'Main',
      key: 'post',
      status: 'draft',
      number: 'PO-1',
      tags: [],
      domains: [],
      conditions: [],
      items: [],
      stages: [],
      values: [],
      doNotContact: false,
      contentType: { key: 'post' },
      entry: { id: 'entry-1' },
    })
);

vi.mock('@wizeworks/db', () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => {
          if (method === 'findFirst' || method === 'findUnique') {
            return () =>
              Promise.resolve(
                worldState.found.has('*') || worldState.found.has(name) ? record() : null
              );
          }
          if (method === 'findMany' || method === 'groupBy') return () => Promise.resolve([]);
          if (method === 'count') return () => Promise.resolve(0);
          return () => Promise.resolve(record());
        },
      }
    );
  const tx: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === '$queryRaw' || name === '$executeRaw') return () => Promise.resolve([]);
        if (name === '$transaction') return (run: (client: unknown) => unknown) => run(tx);
        if (name === 'then') return undefined;
        return model(name);
      },
    }
  );
  return {
    withTenant: (_ctx: unknown, run: (client: unknown) => unknown) => run(tx),
    prisma: tx,
    Prisma: {},
  };
});

/** A service whose every method succeeds with the universal record. */
const service = vi.hoisted(
  () => () =>
    new Proxy(
      {},
      {
        get: (_target, method: string) =>
          method === 'then' ? undefined : () => Promise.resolve(record()),
      }
    )
);

vi.mock('@wizeworks/commerce', () => ({
  productService: service(),
  variantService: service(),
  categoryService: service(),
  collectionService: service(),
  discountService: service(),
  orderService: service(),
}));

vi.mock('@wizeworks/crm', () => {
  class CrmConflictError extends Error {}
  return {
    CrmConflictError,
    companyService: service(),
    dealService: service(),
    pipelineService: service(),
    ticketService: service(),
    segmentService: service(),
    customerService: service(),
    b2bAccountContactService: service(),
    objectDefService: { schemaFor: () => Promise.resolve({ fields: [] }) },
    propertiesFromRow: () => ({ values: {}, problems: [], matchedColumns: [] }),
    describeColumnProblems: () => '',
    describeCustomerError: () => '',
    checkCustomerInput: () => ({ ok: true, problems: [] }),
  };
});

vi.mock('@wizeworks/inventory', () => ({ inventoryService: service() }));

vi.mock('@wizeworks/cms', () => ({
  listContentTypes: () => Promise.resolve([]),
  createContentType: () =>
    Promise.resolve({ contentType: { key: 'post', url_pattern: '/blog/{slug}' } }),
  createEntry: () => Promise.resolve({ entry: { id: 'entry-1' } }),
  updateEntry: () => Promise.resolve({}),
  publishEntry: () => Promise.resolve({}),
}));

vi.mock('@wizeworks/media', () => ({}));

vi.mock('./images', () => ({
  ingestImage: () => Promise.resolve({ assetId: 'asset-1', copied: true, reused: false }),
  filenameFromUrl: (url: string, given?: string) => given ?? url.split('/').pop() ?? 'file',
  linkedNotice: () => '',
}));

const { getProcessor } = await import('./index');

const logger = pino({ level: 'silent' });
const ctx = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  propertyId: '00000000-0000-0000-0000-000000000003',
  tenantSlug: 'acme',
};

/** A value for a field that its kind will accept. */
function sampleFor(field: FieldSpec): string {
  switch (field.kind) {
    case 'email':
      return 'someone@example.com';
    case 'url':
      return 'https://old.example.com/path/picture.jpg';
    case 'money':
      return '12.50';
    case 'integer':
      return '3';
    case 'decimal':
      return '2.5';
    case 'boolean':
      return 'true';
    case 'date':
      return '2024-02-01';
    case 'list':
      return 'alpha, beta';
    case 'enum':
      return field.values?.[0] ?? '';
    case 'slug':
      return 'sample-slug';
    case 'html':
      return '<p>Body</p>';
    case 'phone':
      return '555-0100';
    default:
      if (field.key === 'currency') return 'USD';
      if (field.key === 'country') return 'US';
      return `Sample ${field.key}`;
  }
}

/** Values that walk a processor down its fullest branch where the first enum value
 *  would not (a published post is published; an active discount is activated). */
const PREFERRED: Partial<Record<CanonicalEntity, Record<string, string>>> = {
  content: { status: 'published' },
  discounts: { status: 'active' },
  products: { status: 'active' },
};

/** The worlds each processor is run in. `found` lists the models whose lookup finds
 *  a record; the default is "nothing exists" and "everything exists". */
const WORLDS: Partial<Record<CanonicalEntity, string[][]>> = {
  // A purchase order is only ever created (an existing one is left untouched), and it
  // needs its supplier and SKUs to exist already.
  purchase_orders: [['supplier', 'productVariant', 'warehouse']],
};

/**
 * A row that records which columns are read BY NAME.
 *
 * Walking every column (`Object.entries(row)`, a spread) is not
 * reading them: a processor that copies the whole row somewhere touches every key
 * and saves none of them on purpose. Counting those touches once hid exactly this
 * bug, because the page processor's `Object.entries` sweep for `custom:` fields
 * "read" an Old URL column it never used. A walk shows up as the engine describing
 * each key and then getting it, key after key; a plain `row.key` is a get on its own.
 * So a get that immediately follows the description of the same key, inside a walk
 * that has been doing exactly that from its first key, is not counted. A key-only
 * walk (`Object.keys`) describes key after key without getting any, and the reads
 * that follow it are real.
 */
function recording(row: Record<string, string>, read: Set<string>): Record<string, string> {
  let walk: 'unknown' | 'entries' | 'keys' | null = null;
  let described: string | null = null;
  return new Proxy(row, {
    ownKeys(target) {
      walk = 'unknown';
      described = null;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      if (walk !== null && typeof key === 'string') {
        // Two descriptions in a row with no get between them: a key-only walk.
        if (walk === 'unknown' && described !== null) walk = 'keys';
        described = key;
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    get(target, key, receiver) {
      if (typeof key === 'string') {
        if (walk !== null && walk !== 'keys' && described === key) {
          walk = 'entries';
          described = null;
        } else {
          read.add(key);
          if (walk !== 'entries') {
            walk = null;
            described = null;
          }
        }
      }
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
}

/** A column no processor has any business reading by name. It is on every row so a
 *  walk over the row always crosses at least two keys (which is what tells a walk
 *  from a read), and if a processor ever does read it, it is reported as read and
 *  never offered. */
const PROBE = 'contract_probe';

async function measure(entity: CanonicalEntity): Promise<string[]> {
  const processor = getProcessor(entity);
  if (processor === undefined) throw new Error(`no processor for ${entity}`);
  const fields = ENTITY_FIELDS[entity];
  const value = (field: FieldSpec) => PREFERRED[entity]?.[field.key] ?? sampleFor(field);

  const full = Object.fromEntries(fields.map((field) => [field.key, value(field)]));
  const required = Object.fromEntries(
    fields.filter((field) => field.required === true).map((field) => [field.key, value(field)])
  );
  const rows = [
    { ...full, [PROBE]: 'probe' },
    ...fields.map((field) => ({ ...required, [field.key]: value(field), [PROBE]: 'probe' })),
  ];

  const read = new Set<string>();
  for (const found of WORLDS[entity] ?? [[], ['*']]) {
    worldState.found = new Set(found);
    for (const row of rows) {
      await processor.run(
        ctx,
        [recording(row, read)],
        { upsert: true, vendor: 'shopify', modules: ['builder', 'commerce', 'inventory'] },
        logger
      );
      await processor.preview(ctx, [recording(row, read)], logger);
    }
  }
  worldState.found = new Set();

  // A `custom:` column is a tenant's own field carried through by name; it is not
  // part of the fixed contract.
  return [...read].filter((key) => !key.startsWith('custom:')).sort();
}

describe('every import processor reads exactly the columns Move in offers', () => {
  for (const entity of CANONICAL_ENTITIES) {
    it(`${entity}`, async () => {
      const offered = ENTITY_FIELDS[entity].map((field) => field.key).sort();
      const read = await measure(entity);
      expect({ entity, offeredButNeverRead: offered.filter((key) => !read.includes(key)) }).toEqual(
        { entity, offeredButNeverRead: [] }
      );
      expect({ entity, readButNeverOffered: read.filter((key) => !offered.includes(key)) }).toEqual(
        { entity, readButNeverOffered: [] }
      );
    });
  }
});

describe('the column recorder the contract rests on', () => {
  const row = { a: '1', b: '2', c: '3' };

  it('counts a column read by name', () => {
    const read = new Set<string>();
    const probe = recording(row, read);
    void probe.b;
    expect([...read]).toEqual(['b']);
  });

  it('does not count walking the whole row as reading it', () => {
    const read = new Set<string>();
    const probe = recording(row, read);
    void Object.entries(probe);
    void { ...probe };
    expect([...read]).toEqual([]);
  });

  it('counts the reads that follow a walk over the keys alone', () => {
    const read = new Set<string>();
    const probe = recording(row, read);
    for (const key of Object.keys(probe).filter((name) => name !== 'a')) void probe[key];
    void probe.c;
    expect([...read].sort()).toEqual(['b', 'c']);
  });
});
