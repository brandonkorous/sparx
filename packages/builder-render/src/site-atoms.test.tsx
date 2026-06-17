// Guard for the site-ui atom map (docs/102 Track A). Confirms the recipe bridge
// (class tokens → typed props) and that a representative slice of the newly-exposed
// atoms renders the REAL @sparx/site-ui component — its `st-<base>` identity, the
// author's recipe, and the authored content — through the same renderLeaf path the
// canvas and live site use. Server-render is enough (presentational components).

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BuilderNode } from '@sparx/builder-schemas';

import { renderLeaf, leafWearsClass, type LeafRenderArgs } from './render-leaf';
import { recipeFromClass } from './site-atoms';

/** Render one leaf to static markup with the contextual args defaulted. The atom
 *  types are all CLASS_ON_LEAF, so the host passes node.class through as leafClass —
 *  mirror that here. */
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
    leafClass: opts.leafClass ?? node.class,
    children: opts.children,
    emailSample: opts.emailSample,
    emailBrand: opts.emailBrand,
  };
  return renderToStaticMarkup(<>{renderLeaf(args)}</>);
}

describe('recipeFromClass — lifts recipe tokens out of the leaf class', () => {
  it('splits color / variant / residual utilities', () => {
    expect(recipeFromClass('st-c-success st-v-soft w-full')).toEqual({
      color: 'success',
      variant: 'soft',
      size: undefined,
      className: 'w-full',
    });
  });

  it('reads the field treatment (st-fv-*) and the element-scoped size', () => {
    expect(recipeFromClass('st-c-primary st-fv-outline st-input--sz-lg max-w-sm')).toEqual({
      color: 'primary',
      variant: 'outline',
      size: 'lg',
      className: 'max-w-sm',
    });
  });

  it('is all-undefined for an empty class', () => {
    expect(recipeFromClass(undefined)).toEqual({
      color: undefined,
      variant: undefined,
      size: undefined,
      className: undefined,
    });
  });
});

describe('renderSiteUiAtom (via renderLeaf) — real components + the author recipe', () => {
  it('Alert: the author color WINS over the component default (no duplicate token)', () => {
    const html = leaf(
      { type: 'Alert', props: { title: 'Saved', body: 'All good.' } },
      { leafClass: 'st-c-success st-v-soft' }
    );
    expect(html).toContain('st-alert');
    expect(html).toContain('st-c-success');
    expect(html).toContain('Saved');
    expect(html).toContain('All good.');
    // The component's prop default is info; passing the parsed color as a prop (not a
    // raw className) means the default is never emitted alongside it.
    expect(html).not.toContain('st-c-info');
  });

  it('Input: renders a real <input> with type/placeholder + the field recipe', () => {
    const html = leaf(
      { type: 'Input', props: { type: 'email', placeholder: 'you@example.com', name: 'email' } },
      { leafClass: 'st-c-primary st-fv-outline' }
    );
    expect(html).toContain('<input');
    expect(html).toContain('st-input');
    expect(html).toContain('type="email"');
    expect(html).toContain('placeholder="you@example.com"');
    expect(html).toContain('st-c-primary');
  });

  it('Avatar: derives initials from the name', () => {
    const html = leaf(
      { type: 'Avatar', props: { name: 'Jordan Avery', shape: 'circle', status: 'none' } },
      { leafClass: 'st-c-neutral st-avatar--sz-md' }
    );
    expect(html).toContain('st-avatar');
    expect(html).toContain('JA');
  });

  it('Table: builds a header + body from inline columns/rows', () => {
    const html = leaf({
      type: 'Table',
      props: { columns: 'Name, Role', rows: 'Jordan | Owner\nRiley | Editor' },
    });
    expect(html).toContain('st-table');
    expect(html).toContain('<th');
    expect(html).toContain('Name');
    expect(html).toContain('Owner');
    expect(html).toContain('Editor');
  });

  it('Menu: renders items with hrefs from inline "Label | href" lines', () => {
    const html = leaf({
      type: 'Menu',
      props: { orientation: 'vertical', items: 'Dashboard | /\nOrders | /orders' },
    });
    expect(html).toContain('st-menu');
    expect(html).toContain('Dashboard');
    expect(html).toContain('href="/orders"');
  });

  it('Steps: marks complete (x) and active (*) states', () => {
    const html = leaf({
      type: 'Steps',
      props: { orientation: 'horizontal', items: 'x Account\n* Profile\nConfirm' },
    });
    expect(html).toContain('st-steps');
    expect(html).toContain('Account');
    expect(html).toContain('Profile');
    expect(html).toContain('Confirm');
  });

  it('an unknown type falls through to null (delegation returns undefined)', () => {
    expect(leaf({ type: 'NotARealAtom', props: {} })).toBe('');
  });
});

describe('leafWearsClass — the new atoms style their own element', () => {
  it('is true across the form / feedback / display / nav / mockup families', () => {
    for (const t of ['Input', 'Alert', 'Avatar', 'Table', 'Menu', 'Steps', 'Browser', 'Mask']) {
      expect(leafWearsClass(t)).toBe(true);
    }
  });
});
