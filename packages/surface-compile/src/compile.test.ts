// Runs the REAL Tailwind compiler — proves token utilities resolve to silica's
// --color-* vocabulary (NOT the retired --st-* bridge, which made this compile a
// second source of truth for tenant color; see docs/implementation/
// st-token-retirement.md), structural utilities still work, and unknown classes
// are dropped (not fatal).

import { describe, expect, it } from 'vitest';
import { type BuilderNode } from '@sparx/builder-schemas';
import { BASE_SILICA_THEME } from '@sparx/silica-catalog';
import { compileClasses } from './compile';
import { buildTenantStylesheet } from './index';

describe('compileClasses', () => {
    it('maps a color utility onto silica --color-* vars', async () => {
        const css = await compileClasses(['bg-base-100', 'text-primary-content']);
        expect(css).toContain('.bg-base-100');
        expect(css).toContain('background-color: var(--color-base-100)');
        expect(css).toContain('color: var(--color-primary-content)');
    });

    it('never emits the retired --st-* bridge', async () => {
        // The whole point of the retarget: a compiled surface must not reintroduce a
        // second color vocabulary for the storefront theme to fight with.
        const css = await compileClasses(['bg-primary', 'text-base-content', 'rounded-box', 'p-6']);
        expect(css).not.toContain('--st-');
    });

    it('falls back to the platform base theme when nothing injects a theme', async () => {
        // The :root block is a fallback only — the storefront overrides it unlayered —
        // but it must carry a real value, not an empty custom property.
        const css = await compileClasses(['bg-base-100']);
        expect(css).toContain(`--color-base-100: ${BASE_SILICA_THEME.tokens['--color-base-100']}`);
    });

    it('emits structural utilities and the standard spacing scale', async () => {
        const css = await compileClasses(['flex', 'p-6', 'rounded-box']);
        expect(css).toMatch(/\.flex\b/);
        expect(css).toMatch(/display:\s*flex/);
        // p-6 references the --spacing multiplier — silica has no tenant-rescalable
        // counterpart, so it anchors to the standard unit (docs/118).
        expect(css).toContain('--spacing: 0.25rem');
        expect(css).toContain(`--radius-box: ${BASE_SILICA_THEME.tokens['--radius-box']}`);
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
        const css = await compileClasses(['animate-marquee', 'z-60', 'z-80', 'bx-fixed-top']);
        // The CONTINUOUS animation library (not just the entrance set) + its keyframes.
        expect(css).toMatch(/\.animate-marquee\b/);
        expect(css).toContain('@keyframes marquee');
        // Extended bounded z-scale — named rungs above Tailwind's z-50.
        expect(css).toMatch(/\.z-60\s*\{[^}]*z-index:\s*60/);
        expect(css).toMatch(/\.z-80\s*\{[^}]*z-index:\s*80/);
        // The ONLY sanctioned position:fixed emitter — pinned + cross-axis capped so it
        // can never become a full-viewport clickjacking overlay (docs/98 §3.1).
        expect(css).toMatch(/\.bx-fixed-top\s*\{[^}]*position:\s*fixed/);
        expect(css).toMatch(/\.bx-fixed-top\s*\{[^}]*max-height:\s*50vh/);
    });

    it('keeps raw fixed + arbitrary z-index denied while the named z-scale passes', async () => {
        const css = await compileClasses(['z-60', 'z-[9999]', 'fixed']);
        expect(css).toMatch(/\.z-60\b/);
        expect(css).not.toContain('9999');
        expect(css).not.toMatch(/\.fixed\b/);
    });

    it('compiles the Pillar 6 behavior-composite class patterns', async () => {
        // The data-attribute variants the behavior runtime drives at runtime: the
        // carousel sets data-active on the current dot, the scrollspy sets data-scrolled
        // on the nav, the disclosure sets data-open on the open item (read via group-).
        const css = await compileClasses([
            'data-[active=true]:w-6',
            'data-[scrolled=true]:bg-base-100/90',
            'group-data-[open=true]:rotate-180',
            'animate-marquee',
            'w-max',
            'backdrop-blur',
        ]);
        expect(css).toContain('[data-active="true"]');
        expect(css).toContain('[data-scrolled="true"]');
        expect(css).toContain('[data-open="true"]');
        expect(css).toMatch(/width:\s*max-content/);
        expect(css).toMatch(/\.animate-marquee\b/);
        expect(css).toContain('backdrop-filter');
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
        expect(sheet.css).toContain('var(--color-base-100)');
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
