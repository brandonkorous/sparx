// Runs the REAL Tailwind compiler — proves token utilities resolve to --sf-*,
// structural utilities still work, and unknown classes are dropped (not fatal).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BOX, type BuilderNode } from '@sparx/builder-schemas';
import { compileClasses } from './compile';
import { buildTenantStylesheet } from './index';

describe('compileClasses', () => {
  it('maps a color utility onto the tenant --sf-* var', async () => {
    const css = await compileClasses(['bg-base-100', 'text-primary-content']);
    expect(css).toContain('.bg-base-100');
    expect(css).toContain('--color-base-100: var(--sf-base-100)');
    expect(css).toContain('--color-primary-content: var(--sf-primary-content)');
  });

  it('emits structural utilities and the tenant spacing scale', async () => {
    const css = await compileClasses(['flex', 'p-6', 'rounded-box']);
    expect(css).toMatch(/\.flex\b/);
    expect(css).toMatch(/display:\s*flex/);
    // p-6 references the --spacing multiplier, which we remap to --sf-space-base.
    expect(css).toContain('--spacing: var(--sf-space-base');
    expect(css).toContain('--radius-box: var(--sf-radius-box)');
  });

  it('drops unknown candidates without throwing', async () => {
    const css = await compileClasses(['totally-not-a-real-class-xyz']);
    expect(css).not.toContain('totally-not-a-real-class-xyz');
  });

  it('short-circuits an empty candidate list to empty CSS', async () => {
    expect(await compileClasses([])).toBe('');
  });

  it('minifies when asked', async () => {
    const plain = await compileClasses(['flex', 'p-6']);
    const min = await compileClasses(['flex', 'p-6'], { minify: true });
    expect(min.length).toBeLessThan(plain.length);
    expect(min).toMatch(/\.flex\b/);
  });
});

describe('buildTenantStylesheet', () => {
  function node(p: Partial<BuilderNode> & { id: string; type: string }): BuilderNode {
    return { box: DEFAULT_BOX, props: {}, ...p };
  }

  it('tree-shakes a tree, compiles, and content-hashes', async () => {
    const tree = node({
      id: 'root',
      type: 'Section',
      class: 'flex bg-base-100',
      children: [node({ id: 'c', type: 'Heading', class: 'text-base-content' })],
    });
    const sheet = await buildTenantStylesheet(tree);
    expect(sheet.classes).toEqual(['bg-base-100', 'flex', 'text-base-content']);
    expect(sheet.css).toContain('var(--sf-base-100)');
    expect(sheet.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same tree → same hash', async () => {
    const tree = node({ id: 'r', type: 'Section', class: 'gap-6 bg-primary' });
    const a = await buildTenantStylesheet(tree);
    const b = await buildTenantStylesheet(tree);
    expect(a.hash).toBe(b.hash);
  });

  it('yields empty CSS for a tree with no authored classes', async () => {
    const sheet = await buildTenantStylesheet(node({ id: 'r', type: 'Section' }));
    expect(sheet.css).toBe('');
    expect(sheet.classes).toEqual([]);
  });
});
