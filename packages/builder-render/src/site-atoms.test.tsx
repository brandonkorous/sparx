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

  // An unrecognized `node.type` used to render `null` in BOTH modes, silently: no
  // warning, no placeholder, no telemetry. The container wrapper still rendered, so
  // authored content vanished behind an empty <div> nothing pointed at (docs/125 §2.2).
  // It is now mode-split — the storefront still paints nothing at a shopper, but the
  // author is told (docs/127 §10).
  it('an unknown type renders NOTHING on the live storefront', () => {
    expect(leaf({ type: 'NotARealAtom', props: {} }, { mode: 'live' })).toBe('');
  });

  it('an unknown type is VISIBLE and named in the editor', () => {
    const html = leaf({ type: 'NotARealAtom', props: {} }, { mode: 'edit' });
    expect(html).not.toBe('');
    // The author needs to know WHICH type is missing to act on it, so the type name
    // is in the output rather than a generic "something went wrong".
    expect(html).toContain('NotARealAtom');
  });
});

describe('overlay / floating atoms (docs/102 Track C follow-up)', () => {
  it('Toast: a positioned region anchored by horizontal × vertical, stacking children', () => {
    const html = leaf(
      { type: 'Toast', props: { horizontal: 'end', vertical: 'top' } },
      { children: <span>Heads up</span> }
    );
    expect(html).toContain('st-toast');
    expect(html).toContain('st-toast--h-end');
    expect(html).toContain('st-toast--v-top');
    expect(html).toContain('Heads up');
  });

  it('Toast: previews a sample notification in the editor when empty', () => {
    const html = leaf({ type: 'Toast', props: {} }, { mode: 'edit' });
    expect(html).toContain('st-alert');
    expect(html).toContain('Saved');
  });

  it('FAB: a floating action button wearing the recipe color + an icon', () => {
    const html = leaf(
      { type: 'FAB', props: { icon: 'plus', label: 'New post', placement: 'bottom-end' } },
      { leafClass: 'st-c-accent' }
    );
    expect(html).toContain('st-fab');
    expect(html).toContain('st-fab--bottom-end');
    expect(html).toContain('st-c-accent');
    expect(html).toContain('aria-label="New post"');
  });

  it('FAB: an href turns the main control into a link', () => {
    const html = leaf({ type: 'FAB', props: { label: 'Compose', href: '/new' } });
    expect(html).toContain('<a');
    expect(html).toContain('href="/new"');
  });

  it('Dialog (edit): the trigger recipe + the inline static panel, open for editing', () => {
    const html = leaf(
      {
        type: 'Dialog',
        props: { triggerLabel: 'Open', title: 'Are you sure?', closeLabel: 'Got it' },
      },
      { mode: 'edit', leafClass: 'st-c-accent st-v-soft', children: <p>Body content</p> }
    );
    // The trigger wears node.class as a real Button.
    expect(html).toContain('st-btn');
    expect(html).toContain('st-c-accent');
    expect(html).toContain('st-v-soft');
    expect(html).toContain('>Open<');
    // The canvas panel is the inline static variant (NOT the fixed live modal).
    expect(html).toContain('st-dialog--static');
    expect(html).toContain('Are you sure?');
    expect(html).toContain('Body content');
    expect(html).toContain('Got it');
  });

  it('Dialog (live): renders the trigger; the closed Radix panel is not inline', () => {
    const html = leaf(
      { type: 'Dialog', props: { triggerLabel: 'Open dialog', title: 'Hi' } },
      { mode: 'live', leafClass: 'st-c-primary st-v-solid' }
    );
    expect(html).toContain('st-btn');
    expect(html).toContain('Open dialog');
    expect(html).not.toContain('st-dialog--static');
  });

  it('Dialog (email): falls through to the body content (no JS modal)', () => {
    const html = leaf(
      { type: 'Dialog', props: { triggerLabel: 'Open', title: 'Hi' } },
      { surface: 'email', children: <p>Just the body</p> }
    );
    expect(html).toContain('Just the body');
    expect(html).not.toContain('st-dialog');
  });
});

describe('leafWearsClass — the new atoms style their own element', () => {
  it('is true across the form / feedback / display / nav / mockup / overlay families', () => {
    for (const t of [
      'Input',
      'Alert',
      'Avatar',
      'Table',
      'Menu',
      'Steps',
      'Browser',
      'Mask',
      'Toast',
      'FAB',
      'Dialog',
    ]) {
      expect(leafWearsClass(t)).toBe(true);
    }
  });
});
