import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A form that is nowhere is a 404 (persona issue 226).
 *
 * `getSilicaForm` answered any id with defaults, so a link to another
 * business's form opened a settings panel saying "On your home page" with a
 * Save button. A form with no saved settings is still a real form when it sits
 * on a page, published OR draft: an author opens the settings of a form they
 * have just added, before publishing.
 */

let row: { pageSlug: string | null; recipients: string[]; config: unknown } | null;
let draftTrees: { silicaDraftTree: unknown }[];
let publishedRoot: unknown;

const form = (id: string) => ({
  kind: 'element',
  tag: 'form',
  id,
  data: { kind: 'action', action: 'contact' },
});

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(
      fn({
        formDefinition: { findUnique: () => Promise.resolve(row) },
        builderPage: { findMany: () => Promise.resolve(draftTrees) },
        builderLayout: { findMany: () => Promise.resolve([]) },
      })
    ),
}));
vi.mock('./site-service', () => ({
  getPublishedSite: () =>
    Promise.resolve(publishedRoot ? { pages: [{ slug: 'contact', root: publishedRoot }] } : null),
  getPublishedFrame: () => Promise.resolve({ frame: null }),
}));
vi.mock('@wizeworks/builder-schemas', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  collectSilicaFormIds: (root: { id?: string }) => (root?.id ? [root.id] : []),
}));

const { getSilicaForm } = await import('./form-definition-service');
const { BuilderNotFoundError } = await import('../errors');

const ctx = { tenantId: 't-juniper', propertyId: 'site-1' };

beforeEach(() => {
  row = null;
  draftTrees = [];
  publishedRoot = null;
});

describe('getSilicaForm', () => {
  it('refuses a form that is on no page and has no settings', async () => {
    await expect(getSilicaForm(ctx as never, 'f-nowhere')).rejects.toBeInstanceOf(
      BuilderNotFoundError
    );
  });

  it('answers with defaults for a published form nobody has set up', async () => {
    publishedRoot = form('f-live');
    expect((await getSilicaForm(ctx as never, 'f-live')).pageSlug).toBe('contact');
  });

  it('answers for a form only on a draft page', async () => {
    draftTrees = [{ silicaDraftTree: form('f-draft') }];
    expect((await getSilicaForm(ctx as never, 'f-draft')).formNodeId).toBe('f-draft');
  });

  it('answers for a form with saved settings', async () => {
    row = { pageSlug: null, recipients: ['devi@juniperrow.test'], config: {} };
    expect((await getSilicaForm(ctx as never, 'f-saved')).recipients).toEqual([
      'devi@juniperrow.test',
    ]);
  });
});
