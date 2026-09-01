// The studio-load heal, tested where it actually broke: THE WIRING.
//
// `upgradePageBody` was written, documented, tested and exported — and called by
// nothing. Its own header describes a contract ("runs on the DRAFT at studio load")
// that no code implemented, so three separate repairs shipped into it over months were
// inert on every tenant: the product card's dead `gap-1.5`, the lazy product hero
// (issue 345) and the form routed nowhere (issue 350). `healFrameTx` records that the
// FRAME half had the identical problem until issue 296; this is the half missed then.
//
// So a unit test of the repair function would not have caught this, and the existing
// suite in `upgrade-page.test.ts` is 29 green tests over code that never ran. This
// test drives `load()` — the real studio-load entry point — and asserts the repair
// reaches the row. It is the only kind of test that could have failed before the fix.

import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@wizeworks/db', () => ({
  prisma: {},
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn(globalThis.__tx),
}));

import { load, loadPage } from './site-service';

declare global {
  var __tx: unknown;
}

/** A contact page as the shelf stamped it before issue 350: a real form, carrying the
 *  `form` behavior and an action ref the storefront routes nowhere. */
function stalePage(id = 'page-1') {
  return {
    id,
    propertyId: 'prop-1',
    slug: 'contact',
    name: 'Contact',
    position: 0,
    createdAt: new Date(0),
    kind: 'page',
    recordType: null,
    silicaPublishedTree: null,
    silicaDraftTree: {
      kind: 'element',
      tag: 'section',
      children: [
        {
          kind: 'element',
          tag: 'form',
          class: 'flex flex-col gap-5',
          behavior: { type: 'form' },
          data: { kind: 'action', ref: 'submit' },
          children: [
            { kind: 'element', tag: 'input', attrs: { type: 'text', name: 'name' } },
            { kind: 'element', tag: 'textarea', attrs: { name: 'message' } },
          ],
        },
      ],
    },
  };
}

interface Tx {
  builderPage: { findMany: Mock; findFirst: Mock; update: Mock };
  builderLayout: { findMany: Mock };
  builderSite: { findUnique: Mock };
}

function fakeTx(pages: ReturnType<typeof stalePage>[]): Tx {
  return {
    builderPage: {
      findMany: vi.fn().mockResolvedValue(pages),
      findFirst: vi.fn().mockResolvedValue(pages[0]),
      update: vi.fn(),
    },
    builderLayout: { findMany: vi.fn().mockResolvedValue([]) },
    builderSite: { findUnique: vi.fn().mockResolvedValue(null) },
  };
}

/** The action ref on the first `<form>` anywhere in a tree. */
function formRef(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const n = node as { tag?: string; data?: { ref?: string }; children?: unknown[] };
  if (n.tag === 'form' && n.data?.ref) return n.data.ref;
  for (const child of n.children ?? []) {
    const found = formRef(child);
    if (found) return found;
  }
  return undefined;
}

const CTX = { tenantId: 'tenant-1', propertyId: 'prop-1' };

/** Every module off, so `ensureRecordPagesTx` plans no record pages and the only write
 *  this test can observe is the heal itself. */
const NO_MODULES = { commerceEnabled: false, schedulingEnabled: false, cmsEnabled: false };

describe('load() heals a stale page body', () => {
  let tx: Tx;

  beforeEach(() => {
    tx = fakeTx([stalePage()]);
    globalThis.__tx = tx;
  });

  it('routes a form the storefront was ignoring', async () => {
    const site = await load(CTX, NO_MODULES);
    expect(site).not.toBeNull();
    expect(formRef(site!.pages[0]!.root)).toBe('contact');
  });

  it('WRITES the repair back to the draft column', async () => {
    // In memory is not enough: `publish` republishes the draft column straight from the
    // row, so an author who opens the page and presses Publish without editing would
    // push the stale tree back out and undo a repair they had just been shown.
    await load(CTX, NO_MODULES);
    expect(tx.builderPage.update).toHaveBeenCalledTimes(1);
    const call = tx.builderPage.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { silicaDraftTree: unknown };
    };
    expect(call.where.id).toBe('page-1');
    expect(formRef(call.data.silicaDraftTree)).toBe('contact');
  });

  it('never touches the published column', async () => {
    // A visitor's page must not change under its owner. The heal is draft-only; the
    // published tree keeps whatever it has until the author publishes themselves.
    await load(CTX, NO_MODULES);
    const call = tx.builderPage.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(call.data)).toEqual(['silicaDraftTree']);
  });

  it('writes nothing at all for a page with nothing to repair', async () => {
    // Every studio load runs this. A heal that saved unconditionally would write every
    // page of every site on every open.
    const healthy = stalePage();
    (healthy.silicaDraftTree.children[0] as { data: { ref: string } }).data.ref = 'contact';
    (healthy.silicaDraftTree.children[0] as { attrs?: unknown }).attrs = {
      'data-success-message': 'Thanks.',
    };
    (healthy.silicaDraftTree.children[0] as { children: unknown[] }).children.push({
      kind: 'element',
      tag: 'p',
      class: 'text-base text-base-content empty:hidden',
      attrs: { 'data-sui-part': 'status' },
    });
    tx = fakeTx([healthy]);
    globalThis.__tx = tx;

    await load(CTX, NO_MODULES);
    expect(tx.builderPage.update).not.toHaveBeenCalled();
  });
});

// The read the studio ACTUALLY makes when an author opens one page. `load()` is the
// whole-site read; the page pane calls `loadPage`, so healing only in `load` would have
// left the repair unreachable from the one screen an author uses. That is precisely the
// mistake issue 296 fixed for the FRAME, and it was still live for the page.
describe('loadPage() heals the page the author actually opened', () => {
  let tx: Tx;

  beforeEach(() => {
    tx = fakeTx([stalePage()]);
    globalThis.__tx = tx;
  });

  it('routes the form on the opened page', async () => {
    const page = await loadPage(CTX, 'page-1', NO_MODULES);
    expect(formRef(page.root)).toBe('contact');
  });

  it('writes the repair back rather than healing only what it returns', async () => {
    await loadPage(CTX, 'page-1', NO_MODULES);
    expect(tx.builderPage.update).toHaveBeenCalledTimes(1);
    const call = tx.builderPage.update.mock.calls[0]![0] as {
      data: { silicaDraftTree: unknown };
    };
    expect(formRef(call.data.silicaDraftTree)).toBe('contact');
  });
});
