// Behavioral guard for the unified leaf map (docs/builder/02). Renders leaves with
// react-dom/server and asserts the things the old canvas MOCKS got wrong — so the
// "canvas == production" claim can't silently regress. Server-render is enough: the
// islands are plain React components (one pass resolves their initial state).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BuilderNode } from '@sparx/builder-schemas';

import {
  leafWearsClass,
  parseFaqItems,
  parseFeatureItems,
  renderLeaf,
  resolveBuilderProduct,
  youtubeEmbed,
  mapEmbed,
  type LeafRenderArgs,
} from './render-leaf';
import { SAMPLE_BUILDER_PRODUCT } from './sample-product';

/** Render one leaf to static markup, defaulting the contextual args. */
function leaf(
  node: Partial<BuilderNode> & { type: string },
  opts: Partial<LeafRenderArgs> = {}
): string {
  const args: LeafRenderArgs = {
    node: { id: 'n1', props: {}, ...node },
    value: opts.value,
    cardinality: opts.cardinality ?? 'empty',
    bound: opts.bound ?? false,
    mode: opts.mode ?? 'edit',
    surface: opts.surface ?? 'page',
    leafClass: opts.leafClass,
    children: opts.children,
    emailSample: opts.emailSample,
    emailBrand: opts.emailBrand,
  };
  return renderToStaticMarkup(<>{renderLeaf(args)}</>);
}

describe('renderLeaf — Button is a real, correct element (not an inert span)', () => {
  it('renders a linked button as an <a> carrying the recipe class + label', () => {
    const html = leaf(
      { type: 'Button', props: { label: 'Shop now', href: '/shop' } },
      { leafClass: 'st-btn st-c-primary st-v-solid st-btn--sz-md' }
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/shop"');
    expect(html).toContain('Shop now');
    expect(html).toContain('st-c-primary');
    expect(html).not.toContain('<span'); // the old canvas mock was an inert <span>
  });

  it('renders an action button (no href) as a real <button type="button">', () => {
    const html = leaf({ type: 'Button', props: { label: 'Submit' } });
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('Submit');
  });
});

describe('renderLeaf — commerce atoms render the REAL component with sample data', () => {
  it('BuyBox (edit) shows the sample product price, sale price, variants, and CTA', () => {
    const html = leaf({ type: 'BuyBox', props: {} }, { mode: 'edit' });
    // The default variant (Graphite / S) at 14800¢ with a 18800¢ compare-at.
    expect(html).toContain('$148.00');
    expect(html).toContain('$188.00');
    // The variant picker previews the real swatches/chips (Graphite color, sizes).
    expect(html).toContain('Graphite');
    expect(html).toContain('Add to cart');
    // No leftover mock markers from the old hand-built preview.
    expect(html).not.toContain('Small');
  });

  it('VariantPicker (edit, inside a sample product form) renders option chips', () => {
    // The atom reads ProductForm context; rendered standalone it is null, so assert
    // through the cohesive BuyBox which provides the context above. Here we just
    // confirm the picker markup shape exists in that output.
    const html = leaf({ type: 'BuyBox', props: {} }, { mode: 'edit' });
    expect(html).toContain('bx-variant-picker');
    expect(html).toContain('st-option__values');
  });
});

describe('renderLeaf — email surface paints the email scale', () => {
  it('an h1 Heading on email renders an <h1> with the authored text', () => {
    const html = leaf(
      { type: 'Heading', props: { level: 'h1', text: 'Order confirmed' } },
      { surface: 'email' }
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Order confirmed');
  });

  it('a Button on email renders the accent CTA span (no st-btn recipe)', () => {
    const html = leaf({ type: 'Button', props: { label: 'View order' } }, { surface: 'email' });
    expect(html).toContain('View order');
    expect(html).not.toContain('st-btn');
  });
});

describe('renderLeaf — edit placeholders keep empty nodes selectable; live renders empty', () => {
  it('an empty FAQ shows a sample Q&A in edit mode', () => {
    const html = leaf({ type: 'FAQ', props: { items: '' } }, { mode: 'edit' });
    expect(html).toContain('Your question here?');
  });

  it('an empty NavMenu renders nothing on the live site', () => {
    const html = leaf({ type: 'NavMenu', props: { orientation: 'row' } }, { mode: 'live' });
    expect(html).toBe('');
  });
});

describe('leafWearsClass — shared class-placement predicate', () => {
  it('is true for presentational leaves that style their own element', () => {
    for (const t of ['Heading', 'Text', 'Button', 'Badge', 'Icon', 'PriceTag', 'Image']) {
      expect(leafWearsClass(t)).toBe(true);
    }
  });
  it('is false for containers and the wrapper-styled atoms', () => {
    for (const t of ['Section', 'Stack', 'Grid', 'BuyBox', 'Signup', 'EditorialSection']) {
      expect(leafWearsClass(t)).toBe(false);
    }
  });
});

describe('resolveBuilderProduct — sample fallback only in edit', () => {
  const realProduct = { variants: [{ id: 'v1' }], options: [] } as unknown;

  it('returns the sample fixture for an unusable value in edit mode', () => {
    expect(resolveBuilderProduct(undefined, 'edit')).toBe(SAMPLE_BUILDER_PRODUCT);
    expect(resolveBuilderProduct({}, 'edit')).toBe(SAMPLE_BUILDER_PRODUCT);
  });
  it('returns a usable product as-is on both modes', () => {
    expect(resolveBuilderProduct(realProduct, 'edit')).toBe(realProduct);
    expect(resolveBuilderProduct(realProduct, 'live')).toBe(realProduct);
  });
  it('does NOT substitute the sample on the live site', () => {
    expect(resolveBuilderProduct(undefined, 'live')).toBeUndefined();
  });
});

describe('pure inline-content helpers (one copy now lives in the package)', () => {
  it('parseFaqItems splits Q&A blocks on a dashed separator', () => {
    expect(parseFaqItems('Q1?\nA1\n---\nQ2?\nA2')).toEqual([
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ]);
  });
  it('parseFeatureItems auto-numbers Title | Body lines', () => {
    expect(parseFeatureItems('Fast | It is quick\nSafe | It is secure')).toEqual([
      { number: '01', title: 'Fast', body: 'It is quick' },
      { number: '02', title: 'Safe', body: 'It is secure' },
    ]);
  });
  it('youtubeEmbed normalizes a share link to a privacy embed', () => {
    expect(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    );
    expect(youtubeEmbed('')).toBeNull();
  });
  it('mapEmbed builds a keyless place query', () => {
    expect(mapEmbed('Eiffel Tower', '')).toBe(
      'https://www.google.com/maps?q=Eiffel%20Tower&output=embed'
    );
  });
});
