// Guard for the site atom map (docs/102 Track A). Confirms that a representative
// slice of the exposed atoms renders the REAL silica component — its base class,
// the author's own recipe, and the authored content — through the same renderLeaf
// path the canvas and the live site use.
//
// The recipe-bridge tests that used to sit here are gone with the bridge itself:
// the node's class IS the silica recipe now, so there is nothing to parse back out
// and nothing to keep in sync. What replaced them is `rootClass`, which only has
// to guarantee that a node authored before the class-first catalog still gets its
// base class. See docs/implementation/st-token-retirement.md.
//
// Server-render is enough — every atom asserted here is presentational.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BuilderNode } from '@sparx/builder-schemas';

import { renderLeaf, leafWearsClass, type LeafRenderArgs } from './render-leaf';
import { rootClass } from './site-atoms';

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

describe('rootClass — the base class is guaranteed, never duplicated', () => {
    it('passes a class-first recipe through untouched', () => {
        expect(rootClass('alert', 'alert alert-success alert-soft w-full')).toBe(
            'alert alert-success alert-soft w-full'
        );
    });

    it('prepends the base when the class carries only modifiers', () => {
        // What a node authored before the class-first catalog looks like.
        expect(rootClass('badge', 'badge-primary badge-soft')).toBe('badge badge-primary badge-soft');
    });

    it('is just the base for an empty class, so the atom is never unstyled', () => {
        expect(rootClass('input', undefined)).toBe('input');
        expect(rootClass('input', '   ')).toBe('input');
    });
});

describe('renderSiteAtom (via renderLeaf) — real silica components + the author recipe', () => {
    it('Alert: the author color reaches the element, once', () => {
        const html = leaf(
            { type: 'Alert', props: { title: 'Saved', body: 'All good.' } },
            { leafClass: 'alert alert-success alert-soft' }
        );
        expect(html).toContain('alert-success');
        expect(html).toContain('alert-soft');
        expect(html).toContain('Saved');
        expect(html).toContain('All good.');
        // No second color token fighting the author's.
        expect(html).not.toContain('alert-info');
        // The base appears once, not doubled by the atom re-adding it.
        expect(html.match(/class="alert /g) ?? []).toHaveLength(1);
    });

    it('Input: renders a real <input> with type/placeholder + the field recipe', () => {
        const html = leaf(
            { type: 'Input', props: { type: 'email', placeholder: 'you@example.com', name: 'email' } },
            { leafClass: 'input input-primary' }
        );
        expect(html).toContain('<input');
        expect(html).toContain('type="email"');
        expect(html).toContain('placeholder="you@example.com"');
        expect(html).toContain('input-primary');
    });

    it('Avatar: derives initials from the name', () => {
        const html = leaf(
            { type: 'Avatar', props: { name: 'Jordan Avery', shape: 'circle', status: 'none' } },
            { leafClass: 'avatar avatar-neutral' }
        );
        expect(html).toContain('avatar-neutral');
        expect(html).toContain('JA');
    });

    it('Table: builds a header + body from inline columns/rows', () => {
        const html = leaf({
            type: 'Table',
            props: { columns: 'Name, Role', rows: 'Jordan | Owner\nRiley | Editor' },
        });
        expect(html).toContain('table');
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
        expect(html).toContain('class="menu"');
        expect(html).toContain('Dashboard');
        expect(html).toContain('href="/orders"');
    });

    it('Steps: colors the reached steps (x / *) and leaves the rest plain', () => {
        const html = leaf({
            type: 'Steps',
            props: { orientation: 'horizontal', items: 'x Account\n* Profile\nConfirm' },
        });
        expect(html).toContain('class="steps"');
        expect(html).toContain('Account');
        expect(html).toContain('Profile');
        expect(html).toContain('Confirm');
        // Two reached steps carry the accent; the upcoming one does not.
        expect(html.match(/step-primary/g) ?? []).toHaveLength(2);
        // The authored prefixes are markers, not content.
        expect(html).not.toContain('x Account');
        expect(html).not.toContain('* Profile');
    });

    it('Tag: the builder type renders silica’s badge', () => {
        const html = leaf(
            { type: 'Tag', props: { text: 'Beta' } },
            { leafClass: 'badge badge-warning badge-soft' }
        );
        expect(html).toContain('badge-warning');
        expect(html).toContain('Beta');
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
        expect(html).toContain('fixed');
        expect(html).toContain('end-4');
        expect(html).toContain('top-4');
        expect(html).toContain('Heads up');
    });

    it('Toast: previews a sample notification in the editor when empty', () => {
        const html = leaf({ type: 'Toast', props: {} }, { mode: 'edit' });
        expect(html).toContain('alert');
        expect(html).toContain('Saved');
    });

    it('FAB: a floating action button wearing the recipe color + an icon', () => {
        const html = leaf(
            { type: 'FAB', props: { icon: 'plus', label: 'New post', placement: 'bottom-end' } },
            { leafClass: 'btn-accent' }
        );
        expect(html).toContain('fixed');
        expect(html).toContain('bottom-6');
        expect(html).toContain('end-6');
        expect(html).toContain('btn-accent');
        expect(html).toContain('btn-circle');
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
            { mode: 'edit', leafClass: 'btn btn-accent btn-soft', children: <p>Body content</p> }
        );
        // The trigger wears node.class as a real silica button.
        expect(html).toContain('btn-accent');
        expect(html).toContain('btn-soft');
        expect(html).toContain('>Open<');
        // The canvas panel sits in flow (NOT the fixed live modal).
        expect(html).toContain('dialog-popup static');
        expect(html).toContain('Are you sure?');
        expect(html).toContain('Body content');
        expect(html).toContain('Got it');
    });

    it('Dialog (edit): a node with no class still gets a real button trigger', () => {
        const html = leaf(
            { type: 'Dialog', props: { triggerLabel: 'Open', title: 'Hi' } },
            { mode: 'edit' }
        );
        expect(html).toContain('btn');
        expect(html).toContain('btn-primary');
    });

    it('Dialog (live): renders the trigger; the closed panel is not inline', () => {
        const html = leaf(
            { type: 'Dialog', props: { triggerLabel: 'Open dialog', title: 'Hi' } },
            { mode: 'live', leafClass: 'btn btn-primary' }
        );
        expect(html).toContain('btn-primary');
        expect(html).toContain('Open dialog');
        expect(html).not.toContain('dialog-popup static');
    });

    it('Dialog (email): falls through to the body content (no JS modal)', () => {
        const html = leaf(
            { type: 'Dialog', props: { triggerLabel: 'Open', title: 'Hi' } },
            { surface: 'email', children: <p>Just the body</p> }
        );
        expect(html).toContain('Just the body');
        expect(html).not.toContain('dialog-popup');
    });
});

describe('leafWearsClass — the atoms style their own element', () => {
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
