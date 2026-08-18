// The page/layout import parsers are the ONE validation every authoring transport
// (editor Import, REST, MCP) runs. These pin the envelope contract that agents
// depend on — notably that inline SEO round-trips into meta, and that an omitted
// SEO field stays `undefined` (so a tree-only update never silently wipes a title).

import { describe, expect, it } from 'vitest';

import { parseLayoutImport, parsePageImport } from './import-export';

const tree = {
  type: 'Section',
  props: {},
  children: [{ type: 'Heading', props: { level: 'h1', text: 'Hi' } }],
};

describe('parsePageImport — SEO passthrough', () => {
  it('carries the envelope SEO fields into meta', () => {
    const parsed = parsePageImport({
      format: 'sparx.builder/v1',
      type: 'page',
      name: 'About',
      kind: 'singleton',
      slug: 'about',
      seoTitle: 'About — Acme',
      seoDescription: 'Who we are.',
      canonical: '/about',
      noindex: true,
      tree,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.meta.seoTitle).toBe('About — Acme');
      expect(parsed.meta.seoDescription).toBe('Who we are.');
      expect(parsed.meta.canonical).toBe('/about');
      expect(parsed.meta.noindex).toBe(true);
    }
  });

  it('leaves omitted SEO fields undefined so an update never wipes them', () => {
    const parsed = parsePageImport({
      format: 'sparx.builder/v1',
      type: 'page',
      name: 'About',
      tree,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.meta.seoTitle).toBeUndefined();
      expect(parsed.meta.seoDescription).toBeUndefined();
      expect(parsed.meta.noindex).toBeUndefined();
    }
  });

  it('distinguishes an explicit blank (clear) from an omitted field (keep)', () => {
    const parsed = parsePageImport({
      format: 'sparx.builder/v1',
      type: 'page',
      name: 'About',
      seoTitle: '',
      tree,
    });
    expect(parsed.ok).toBe(true);
    // Present-but-blank stays '' (the service maps it to null → "clear"); it is
    // NOT undefined, which would mean "leave the stored value alone".
    if (parsed.ok) expect(parsed.meta.seoTitle).toBe('');
  });

  it('a bare node tree carries no page or SEO meta', () => {
    const parsed = parsePageImport(tree);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.meta.name).toBeUndefined();
      expect(parsed.meta.seoTitle).toBeUndefined();
    }
  });
});

describe('parseLayoutImport', () => {
  it('validates a layout envelope and pulls the name into meta', () => {
    const parsed = parseLayoutImport({
      format: 'sparx.builder/v1',
      type: 'layout',
      name: 'Site chrome',
      tree: {
        type: 'Stack',
        props: {},
        children: [{ type: 'Outlet', props: {} }],
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.meta.name).toBe('Site chrome');
  });
});
