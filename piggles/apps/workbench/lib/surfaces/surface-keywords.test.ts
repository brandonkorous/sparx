import { describe, expect, it } from 'vitest';

import { surfaceKeywords, type SurfaceDefinition } from './registry';
import { PIGGLES_SECTIONS } from '../console/section-names';
import { configureProduct } from '../product';

// The console's own `lib/console/product.tsx` cannot be imported here — the test
// seat is `environment: 'node'` with no JSX transform and that file renders a
// mascot. The heading table is fed in directly instead, which is the part under
// test anyway: `configureProduct` is the same function the shell calls, and
// `PIGGLES_SECTIONS` is the same table it passes.
//
// The registry itself is out of reach for the same reason: registering a surface
// means importing its component. So these are definitions built by hand. What is
// being tested is the rule, not the catalog.
configureProduct({ sectionTitles: PIGGLES_SECTIONS, surfaceTitles: {} });

const Nothing = (() => null) as unknown as SurfaceDefinition['component'];

function surface(partial: Partial<SurfaceDefinition>): SurfaceDefinition {
  return {
    key: 'test.surface',
    title: 'A screen',
    module: 'crm',
    component: Nothing,
    ...partial,
  } as SurfaceDefinition;
}

const words = (definition: SurfaceDefinition): string[] =>
  surfaceKeywords(definition).map((word) => word.toLowerCase());

describe('surfaceKeywords', () => {
  it('finds a screen by the heading the navigation panel shows above it', () => {
    // Typing "keeping it legal" into the box that asks what you want to do
    // answered "Nothing matches that", over a section with screens in it.
    expect(words(surface({ section: 'Compliance' }))).toContain('keeping it legal');
  });

  it('keeps the platform spelling of the heading as well as this brand s', () => {
    // Somebody who learned the other console, or read a support page, arrives
    // knowing the old word. It is the same argument the old TITLE is kept for.
    const out = words(surface({ section: 'Compliance' }));
    expect(out).toContain('compliance');
    expect(out).toContain('keeping it legal');
  });

  it('covers every renamed heading, not just the one that was noticed', () => {
    for (const [platform, piggles] of Object.entries(PIGGLES_SECTIONS)) {
      const out = words(surface({ section: platform }));
      expect(out).toContain(platform.toLowerCase());
      expect(out).toContain(piggles.toLowerCase());
    }
  });

  it('carries a heading that was never renamed, once', () => {
    const out = words(surface({ section: 'People' }));
    expect(out.filter((w) => w === 'people')).toHaveLength(1);
  });

  it('still carries the words the surface declared for itself', () => {
    const out = words(surface({ keywords: ['contacts', 'buyers'], section: 'People' }));
    expect(out).toContain('contacts');
    expect(out).toContain('buyers');
  });

  it('still carries the platform title when this brand renamed the screen', () => {
    configureProduct({ surfaceTitles: { 'test.surface': 'Groups of products' } });
    expect(words(surface({ title: 'Collections' }))).toContain('collections');
    configureProduct({ surfaceTitles: {} });
  });

  it('adds nothing for a screen that sits under no heading', () => {
    expect(words(surface({ keywords: ['solo'] }))).toEqual(['solo']);
  });

  it('has headings to test at all', () => {
    // Without this the whole file passes over an empty table and says nothing.
    expect(Object.keys(PIGGLES_SECTIONS).length).toBeGreaterThan(5);
  });
});
