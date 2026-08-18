// definitionService + custom-section publish pinning (docs/38 Phase C):
//   • a definition is a tenant-scoped custom section TYPE (field spec + template
//     AST), validated semantically (validateTemplate) before persisting;
//   • a placed `custom:<slug>` section validates/defaults its config against the
//     derived schema, exactly like a code section;
//   • publishing PINS the referenced definitions into the version snapshot, so a
//     custom section renders deterministically even after the live definition
//     changes or is deleted;
//   • deleting an in-use definition is refused (drafts would break); already-
//     published pages keep rendering from the pin.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { definitionService, sectionService, publishService } from '../../src/services/index.js';
import { SitebuilderConflictError } from '../../src/errors.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const FIELD_SPEC = [
  { key: 'heading', label: 'Heading', type: 'text' as const },
  {
    key: 'items',
    label: 'Items',
    type: 'list' as const,
    itemFields: [{ key: 'title', label: 'Title', type: 'text' as const }],
  },
];

const TEMPLATE = {
  type: 'Stack' as const,
  children: [
    { type: 'Heading' as const, level: 2 as const, text: { $bind: 'field.heading' } },
    {
      type: 'Repeater' as const,
      each: 'items',
      children: [{ type: 'Text' as const, text: { $bind: 'item.title' } }],
    },
  ],
};

const DEF_INPUT = {
  slug: 'icon-grid',
  label: 'Icon grid',
  description: 'A grid of features.',
  fieldSpec: FIELD_SPEC,
  template: TEMPLATE,
};

describe('sitebuilder custom section definitions', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('create — persists a definition and exposes it via list/get', async () => {
    const created = await definitionService.create(test.ctx, DEF_INPUT);
    expect(created.type).toBe('custom:icon-grid');
    expect(created.version).toBe(1);

    const listed = await definitionService.list(test.ctx);
    expect(listed.map((d) => d.slug)).toContain('icon-grid');
    expect((await definitionService.get(test.ctx, 'icon-grid')).label).toBe('Icon grid');
  });

  it('create — rejects a duplicate slug and a semantically invalid template', async () => {
    await expect(definitionService.create(test.ctx, DEF_INPUT)).rejects.toBeInstanceOf(
      SitebuilderConflictError
    );
    // Binds an undeclared field → validateTemplate fails.
    await expect(
      definitionService.create(test.ctx, {
        slug: 'broken',
        label: 'Broken',
        fieldSpec: [{ key: 'heading', label: 'Heading', type: 'text' as const }],
        template: { type: 'Text' as const, text: { $bind: 'field.nope' } },
      })
    ).rejects.toThrow();
  });

  it('section.create — validates a custom config against the derived schema', async () => {
    const section = await sectionService.create(test.ctx, {
      targetId: 'site:home',
      sectionType: 'custom:icon-grid',
      config: { heading: 'Why us', items: [{ title: 'Fast' }, { title: 'Local' }] },
    });
    expect(section.sectionType).toBe('custom:icon-grid');
    const cfg = section.config as Record<string, unknown>;
    expect(cfg.heading).toBe('Why us');
    expect((cfg.items as unknown[]).length).toBe(2);

    // An unknown custom type can't be placed.
    await expect(
      sectionService.create(test.ctx, {
        targetId: 'site:home',
        sectionType: 'custom:ghost',
        config: {},
      })
    ).rejects.toThrow();
  });

  it('publish — pins the referenced definition into the snapshot', async () => {
    const version = await publishService.publishNow(test.ctx, {});
    const snap = await publishService.getPublishedSnapshot(test.ctx);
    expect(snap).not.toBeNull();
    const pin = snap!.definitions.find((d) => d.slug === 'icon-grid');
    expect(pin).toBeDefined();
    expect(pin!.version).toBe(1);
    expect(pin!.template).toEqual(TEMPLATE);
    // The published custom section is present in the home composition.
    expect(snap!.sections.some((s) => s.sectionType === 'custom:icon-grid')).toBe(true);
    expect(version.versionNumber).toBeGreaterThanOrEqual(1);
  });

  it('update — bumps the version, re-pinned on the next publish', async () => {
    // Update omits the immutable slug (it's the placed-section type identity).
    const updated = await definitionService.update(test.ctx, 'icon-grid', {
      label: 'Feature grid',
      description: DEF_INPUT.description,
      fieldSpec: FIELD_SPEC,
      template: TEMPLATE,
    });
    expect(updated.version).toBe(2);
    expect(updated.label).toBe('Feature grid');

    await publishService.publishNow(test.ctx, {});
    const snap = await publishService.getPublishedSnapshot(test.ctx);
    expect(snap!.definitions.find((d) => d.slug === 'icon-grid')!.version).toBe(2);
  });

  it('delete — refused while a draft section places it, allowed after removal', async () => {
    await expect(definitionService.remove(test.ctx, 'icon-grid')).rejects.toBeInstanceOf(
      SitebuilderConflictError
    );

    const sections = await sectionService.listForTarget(test.ctx, 'site:home');
    const custom = sections.find((s) => s.sectionType === 'custom:icon-grid');
    await sectionService.remove(test.ctx, custom!.id);

    await expect(definitionService.remove(test.ctx, 'icon-grid')).resolves.toEqual({
      slug: 'icon-grid',
    });
    await expect(definitionService.get(test.ctx, 'icon-grid')).rejects.toThrow();
  });
});
