// The styling guide an agent reads is only useful if what it teaches is VALID.
// These tests pin the guide to the real schema: every example/recipe tree the
// guide ships must pass the same `parsePageImport` the create/update tools run,
// and the tool bundle must expose the expected authoring surface. If the node
// schema or the document format drifts, the guide fails here instead of teaching
// an agent to emit a tree the service will reject.

import { describe, expect, it } from 'vitest';
import { parsePageImport } from '@sparx/builder-schemas';
import { validateClasses } from '@sparx/surface-compile';

import { builderMcpTools } from './index';
import { BUILDER_STYLE_GUIDE } from './vocabulary';

describe('BUILDER_STYLE_GUIDE', () => {
  it('teaches a document example that validates as a page', () => {
    const parsed = parsePageImport(BUILDER_STYLE_GUIDE.documentFormat.example);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.meta.name).toBe('About');
      expect(parsed.meta.slug).toBe('about');
    }
  });

  it('teaches recipe trees that all validate as bare node trees', () => {
    for (const recipe of BUILDER_STYLE_GUIDE.recipes) {
      const parsed = parsePageImport(recipe.tree);
      expect(parsed.ok, `recipe "${recipe.name}" should validate`).toBe(true);
    }
  });

  it('advertises the container-query breakpoint scale (not viewport)', () => {
    expect(BUILDER_STYLE_GUIDE.responsive.breakpoints).toContain('@3xl');
    expect(BUILDER_STYLE_GUIDE.responsive.strategy).toMatch(/container quer/i);
  });

  it('teaches motion classes that all pass the safety allowlist (docs/61 §9)', () => {
    const m = BUILDER_STYLE_GUIDE.classVocabulary.motion;
    const classes = [
      'sf-reveal',
      'sf-reveal-stagger',
      'sf-reveal-stagger--bold',
      ...m.tokens.map((t) => `animate-${t}`),
      ...m.tokens.map((t) => `hover:animate-${t}`),
      ...m.tokens.map((t) => `sf-reveal--${t}`),
      ...m.transitions,
    ];
    expect(validateClasses(classes).blocked).toEqual([]);
  });
});

describe('builderMcpTools', () => {
  it('exposes the read + write authoring surface', () => {
    const names = builderMcpTools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'describe_builder_styling',
        'list_builder_pages',
        'get_builder_page',
        'create_builder_page',
        'update_builder_page',
        'publish_builder_page',
        'delete_builder_page',
      ])
    );
  });

  it('gates go-live + delete behind confirmation, leaves authoring un-gated', () => {
    const byName = new Map(builderMcpTools.map((t) => [t.name, t]));
    expect(byName.get('publish_builder_page')?.confirmation).toBe(true);
    expect(byName.get('delete_builder_page')?.confirmation).toBe(true);
    expect(byName.get('create_builder_page')?.confirmation).toBe(false);
    expect(byName.get('update_builder_page')?.confirmation).toBe(false);
  });

  it('scopes reads to read:builder and writes to write:builder', () => {
    for (const t of builderMcpTools) {
      const expected = /^(describe|list|get)_/.test(t.name) ? 'read:builder' : 'write:builder';
      expect(t.scope, t.name).toBe(expected);
    }
  });

  it('describe_builder_styling returns the guide without a service call', async () => {
    const tool = builderMcpTools.find((t) => t.name === 'describe_builder_styling');
    expect(tool).toBeDefined();
    // No DB/ctx needed — it is static data.
    const result = await tool!.run({ tenantId: 't', userId: 'u' }, {});
    expect(result).toBe(BUILDER_STYLE_GUIDE);
  });
});
