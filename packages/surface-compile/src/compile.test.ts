// Runs the REAL Tailwind compiler — proves token utilities resolve to --st-*,
// structural utilities still work, and unknown classes are dropped (not fatal).

import { describe, expect, it } from 'vitest';
import { type BuilderNode } from '@sparx/builder-schemas';
import { compileClasses } from './compile';
import { buildTenantStylesheet } from './index';

describe('compileClasses', () => {
  it('maps a color utility onto the tenant --st-* var', async () => {
    const css = await compileClasses(['bg-base-100', 'text-primary-content']);
    expect(css).toContain('.bg-base-100');
    expect(css).toContain('--color-base-100: var(--st-base-100)');
    expect(css).toContain('--color-primary-content: var(--st-primary-content)');
  });

  it('emits structural utilities and the tenant spacing scale', async () => {
    const css = await compileClasses(['flex', 'p-6', 'rounded-box']);
    expect(css).toMatch(/\.flex\b/);
    expect(css).toMatch(/display:\s*flex/);
    // p-6 references the --spacing multiplier, which we remap to --st-space-base.
    expect(css).toContain('--spacing: var(--st-space-base');
    expect(css).toContain('--radius-box: var(--st-radius-box)');
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

  it('emits a custom Surface entrance animation + its keyframes', async () => {
    const css = await compileClasses(['animate-fade-up']);
    expect(css).toMatch(/\.animate-fade-up\b/);
    expect(css).toContain('@keyframes fade-up');
  });

  it('drops a weaponizable class (position: fixed) at the compile choke point', async () => {
    const css = await compileClasses(['fixed', 'relative']);
    expect(css).toMatch(/\.relative\b/);
    expect(css).not.toMatch(/\.fixed\b/);
  });

  it('emits the Pillar 4 motion library, bounded z-scale, and guarded fixed', async () => {
    const css = await compileClasses(['animate-marquee', 'z-60', 'z-80', 'st-fixed-top']);
    // The CONTINUOUS animation library (not just the entrance set) + its keyframes.
    expect(css).toMatch(/\.animate-marquee\b/);
    expect(css).toContain('@keyframes marquee');
    // Extended bounded z-scale — named rungs above Tailwind's z-50.
    expect(css).toMatch(/\.z-60\s*\{[^}]*z-index:\s*60/);
    expect(css).toMatch(/\.z-80\s*\{[^}]*z-index:\s*80/);
    // The ONLY sanctioned position:fixed emitter — pinned + cross-axis capped so it
    // can never become a full-viewport clickjacking overlay (docs/98 §3.1).
    expect(css).toMatch(/\.st-fixed-top\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.st-fixed-top\s*\{[^}]*max-height:\s*50vh/);
  });

  it('keeps raw fixed + arbitrary z-index denied while the named z-scale passes', async () => {
    const css = await compileClasses(['z-60', 'z-[9999]', 'fixed']);
    expect(css).toMatch(/\.z-60\b/);
    expect(css).not.toContain('9999');
    expect(css).not.toMatch(/\.fixed\b/);
  });

  it('ships the navbar component + start/center/end zones (daisyUI-faithful)', async () => {
    const css = await compileClasses(['navbar', 'navbar-start', 'navbar-center', 'navbar-end']);
    expect(css).toMatch(/\.navbar\b/);
    expect(css).toContain('.navbar-start');
    expect(css).toContain('.navbar-center');
    expect(css).toContain('.navbar-end');
    // The centering mechanism: 50%-width side zones, shrink-0 center between them.
    expect(css).toMatch(/\.navbar-start\s*\{[^}]*width:\s*50%/);
    expect(css).toMatch(/\.navbar-end\s*\{[^}]*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.navbar-center\s*\{[^}]*flex-shrink:\s*0/);
  });
});

describe('buildTenantStylesheet', () => {
  function node(p: Partial<BuilderNode> & { id: string; type: string }): BuilderNode {
    return { props: {}, ...p };
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
    expect(sheet.css).toContain('var(--st-base-100)');
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
