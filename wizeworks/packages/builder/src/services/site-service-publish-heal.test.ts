// Publishing heals what opening heals (piggles persona issue 986).
//
// The repairs in `upgradePageBody` land on a page's draft when its owner OPENS it.
// `publish` copied every draft as it stood, so a page nobody had opened since a repair
// shipped went live stale. The Marrow Review pressed "Publish everything" after the
// page-measure repair (issue 950) and her Archive kept its heading 24px left of her
// header's name, and the publish screen named one page out of the many it changed.
//
// These drive the real `publish` and `publishState` over a page stamped the old way: a
// band with the gutter on it and a bare 6xl measure inside.

import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@wizeworks/db', () => ({
  prisma: {},
  Prisma: { DbNull: 'DbNull' },
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn(globalThis.__publishTx),
}));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn() }));
vi.mock('./node-index-service', () => ({ reindexTreeTx: vi.fn(), dropOwnerTx: vi.fn() }));
vi.mock('./surface-css-service', () => ({ invalidatePublishedStylesheet: vi.fn() }));
vi.mock('./page-search', () => ({
  withPageSearch: (_ctx: unknown, fn: () => unknown) => fn(),
  indexSitePages: vi.fn(),
}));
vi.mock('../events', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  publishBuilderEvent: vi.fn(),
}));
vi.mock('./artifact-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recordArtifactTx: vi.fn().mockResolvedValue('hash'),
  createReleaseTx: vi.fn().mockResolvedValue({ id: 'release-1', hash: 'release-hash' }),
}));

import { publish, publishState } from './site-service';

declare global {
  var __publishTx: unknown;
}

/** A page top stamped before issue 950: the gutter on the band, the measure bare. */
function outsideBand() {
  return {
    kind: 'element',
    tag: 'div',
    class: 'flex flex-col',
    children: [
      {
        kind: 'element',
        tag: 'section',
        class: 'bg-base-100 @container px-6 py-16',
        children: [
          {
            kind: 'element',
            tag: 'div',
            class: 'mx-auto flex w-full max-w-6xl flex-col gap-10',
            children: [{ kind: 'element', tag: 'h1', class: 'text-4xl', text: 'Archive' }],
          },
        ],
      },
    ],
  };
}

/** Never opened since the repair shipped: draft and live agree, and both are stale. */
function unopenedPage() {
  return {
    id: 'archive',
    propertyId: 'prop-1',
    slug: 'archive',
    name: 'Archive',
    kind: 'singleton',
    recordType: null,
    frameId: null,
    publishedFrameId: null,
    publishedAt: new Date(0),
    silicaDraftTree: outsideBand(),
    silicaPublishedTree: outsideBand(),
  };
}

interface Tx {
  builderPage: { findMany: Mock; update: Mock };
  builderLayout: { findMany: Mock };
  builderSite: { findUnique: Mock };
}

function fakeTx(pages: unknown[]): Tx {
  return {
    builderPage: { findMany: vi.fn().mockResolvedValue(pages), update: vi.fn() },
    builderLayout: { findMany: vi.fn().mockResolvedValue([]) },
    builderSite: { findUnique: vi.fn().mockResolvedValue(null) },
  };
}

/** The class of the band and of the box inside it, in a stored tree. */
function bandClasses(tree: unknown): [string, string] {
  const band = (tree as { children: { class: string; children: { class: string }[] }[] })
    .children[0]!;
  return [band.class, band.children[0]!.class];
}

const CTX = { tenantId: 'tenant-1', propertyId: 'prop-1' };

describe('publish() heals a page its owner never opened', () => {
  let tx: Tx;

  beforeEach(() => {
    tx = fakeTx([unopenedPage()]);
    globalThis.__publishTx = tx;
  });

  it('puts the repaired tree live, not the stale draft', async () => {
    await publish(CTX);
    const live = tx.builderPage.update.mock.calls
      .map((call) => (call[0] as { data: { silicaPublishedTree?: unknown } }).data)
      .find((data) => data.silicaPublishedTree !== undefined);
    expect(bandClasses(live!.silicaPublishedTree)).toEqual([
      'bg-base-100 @container py-16',
      'mx-auto flex w-full max-w-6xl px-6 flex-col gap-10',
    ]);
  });

  it('writes the repair to the draft too, so the editor opens on what is live', async () => {
    await publish(CTX);
    const draft = tx.builderPage.update.mock.calls
      .map((call) => (call[0] as { data: { silicaDraftTree?: unknown } }).data)
      .find((data) => data.silicaDraftTree !== undefined);
    expect(bandClasses(draft!.silicaDraftTree)[1]).toContain('px-6');
  });
});

describe('publishState() names the pages a publish would repair', () => {
  it('counts a page whose draft and live agree but are both behind', async () => {
    globalThis.__publishTx = fakeTx([unopenedPage()]);
    const state = await publishState(CTX);
    expect(state.unpublishedPages).toBe(1);
    expect(state.unpublishedPageList.map((p) => p.name)).toEqual(['Archive']);
  });

  it('counts nothing for a page already at the house measure', async () => {
    const healthy = unopenedPage();
    for (const tree of [healthy.silicaDraftTree, healthy.silicaPublishedTree]) {
      const band = tree.children[0]!;
      band.class = 'bg-base-100 @container py-16';
      band.children[0]!.class = 'mx-auto flex w-full max-w-6xl px-6 flex-col gap-10';
    }
    globalThis.__publishTx = fakeTx([healthy]);
    const state = await publishState(CTX);
    expect(state.unpublishedPages).toBe(0);
    expect(state.hasUnpublished).toBe(false);
  });
});
