// Tests for the legacy box/layout → class-only tree migration (docs/61).
// The backfill (packages/db/scripts/backfill-builder-class.ts) relies on these
// guarantees: faithful conversion, the band/content split, idempotency, and
// passthrough of already-migrated nodes.

import { describe, expect, it } from 'vitest';
import { migrateNode, migrateTree, type LegacyNode } from './box-to-class';

describe('migrateNode / migrateTree', () => {
  it('converts a container box/layout into a class string and drops the objects', () => {
    const legacy: LegacyNode = {
      id: 'n1',
      type: 'Section',
      box: { padding: 'lg', surface: 'subtle', backgroundWidth: 'full', contentWidth: 'full' },
      layout: { direction: 'grid', columns: 3, gap: 'md' },
      props: {},
    };
    const out = migrateNode(legacy);
    expect(out).not.toHaveProperty('box');
    expect(out).not.toHaveProperty('layout');
    expect(out.class).toContain('grid');
    expect(out.class).toContain('bg-base-200'); // surface: subtle
    expect(out.class).toContain('p-10'); // padding: lg
    expect(out.class).toContain('gap-4'); // gap: md
  });

  it('splits a full-bleed band with contained content into outer band + inner column', () => {
    const legacy: LegacyNode = {
      id: 'hero',
      type: 'Section',
      box: {
        surface: 'inverse',
        height: 'lg',
        backgroundWidth: 'full',
        contentWidth: 'contained',
        padding: 'xl',
      },
      layout: { direction: 'stack', gap: 'sm' },
      props: {},
      children: [{ id: 'h', type: 'Heading', props: { text: 'Hi' } }],
    };
    const out = migrateNode(legacy);
    // Outer keeps the id + band utilities (full width, surface, height).
    expect(out.id).toBe('hero');
    expect(out.class).toContain('w-full');
    expect(out.class).toContain('bg-neutral'); // surface: inverse
    // Inner is a single Stack wrapper carrying the centered, contained column.
    expect(out.children).toHaveLength(1);
    const inner = out.children?.[0];
    expect(inner?.type).toBe('Stack');
    expect(inner?.id).toBe('hero__c');
    expect(inner?.class).toContain('max-w-site');
    expect(inner?.class).toContain('p-16'); // padding: xl
    // The original child rides under the inner wrapper.
    expect(inner?.children?.[0]?.id).toBe('h');
  });

  it('moves a box background image to node bg-* props', () => {
    const legacy: LegacyNode = {
      id: 'tile',
      type: 'Card',
      box: { backgroundImage: 'https://img.test/x.jpg', overlay: 'dark' },
      props: {},
    };
    const out = migrateNode(legacy);
    expect(out.props.bgImage).toBe('https://img.test/x.jpg');
    expect(out.props.bgOverlay).toBe('dark');
  });

  it('passes through an already class-only node untouched (recursing children)', () => {
    const modern: LegacyNode = {
      id: 'a',
      type: 'Section',
      class: 'w-full flex flex-col',
      props: {},
      children: [{ id: 'b', type: 'Section', box: { padding: 'sm' }, props: {} }],
    };
    const { tree, stats } = migrateTree(modern);
    expect(tree.class).toBe('w-full flex flex-col'); // unchanged
    expect(stats.passthrough).toBe(1); // the root
    expect(stats.converted).toBe(1); // the child had a box
    expect(tree.children?.[0]?.class).toContain('p-3'); // padding: sm
  });

  it('is idempotent — a second migration converts nothing', () => {
    const legacy: LegacyNode = {
      id: 'root',
      type: 'Section',
      box: { surface: 'inverse', height: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
      layout: { direction: 'grid', columns: 2, gap: 'lg' },
      props: {},
      children: [
        {
          id: 'c1',
          type: 'Card',
          box: { padding: 'md' },
          layout: { direction: 'stack' },
          props: {},
        },
      ],
    };
    const first = migrateTree(legacy);
    const second = migrateTree(first.tree);
    expect(second.stats.converted).toBe(0);
    expect(second.tree).toEqual(first.tree);
  });

  it('preserves binding + name and drops a (dead) non-empty hiddenOn, counting it', () => {
    const legacy: LegacyNode = {
      id: 'list',
      type: 'Grid',
      name: 'Post grid',
      binding: { path: 'cms.posts' },
      box: { padding: 'md', hiddenOn: ['mobile'] },
      layout: { direction: 'grid', columns: 3 },
      props: {},
    };
    const { tree, stats } = migrateTree(legacy);
    expect(tree.name).toBe('Post grid');
    expect(tree.binding).toEqual({ path: 'cms.posts' });
    expect(tree).not.toHaveProperty('box');
    expect(stats.droppedHiddenOn).toBe(1);
  });
});
