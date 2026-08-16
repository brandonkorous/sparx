// The shared shell every sparx section is built on (docs/builder-audit slice 19).
//
// WHY A SHELL AND NOT COPY-PASTE. Forty sections that each hand-write their own page
// gutter, measure and vertical rhythm are forty chances to drift, and the drift is
// visible: two sections stacked on one page with different side padding read as two
// different sites. One `section()` means a page composed from any six of these lines
// up down the left edge without the author doing anything.
//
// THE HOUSE RULES ARE ENFORCED BY CONSTRUCTION HERE, not left to each author:
//
//   · NO EYEBROW. `sectionHead` takes a heading and an optional lead PARAGRAPH that
//     sits BELOW it. There is no slot above a heading, so the pattern cannot be
//     authored through this kit at all (CLAUDE.md RULE #2).
//   · BODY TEXT IS 16px MINIMUM. `text-base` is the floor for anything meant to be
//     read; `text-sm` appears only on genuine captions and metadata.
//   · READABLE INK IS A REAL TOKEN. No `/60` opacity, no `text-soft` on words a
//     visitor is meant to read (RULE #3). Hierarchy comes from scale and weight.
//   · CONTAINER QUERIES, NEVER VIEWPORT VARIANTS. A section is measured by its own
//     width, so it lays out correctly in the canvas, in a narrow column and on a
//     phone — and the device toggle tells the truth (see `vocabulary-check.ts`).
//   · NO GRADIENT, NO SHADOW AS A DEVICE. Surfaces separate by edge, radius and a
//     base-tone shift.
//
// EVERY CLASS IS A LITERAL STRING. The Tailwind `@source` harness scans this package,
// so a composed class string would ship utilities that were never generated — and the
// failure is silent once the tree is stamped into a tenant's database (the authoring
// contract in `site-chrome.ts`, and the whole reason `checkClassString` exists).

import { el, type Node } from '@wizeworks/silicaui-html';

/** The outer band: full-bleed surface, its own container context, page gutter and
 *  vertical rhythm. Everything else nests inside its measure. */
export function section(children: Node[]): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', { children })],
    });
}

/** A band on the alternate surface, for a section that needs to separate from the one
 *  above it without a rule or a shadow. */
export function sectionAlt(children: Node[]): Node {
    return el('section', 'bg-base-200 @container px-6 py-16', {
        children: [el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', { children })],
    });
}

/** A narrower band for reading — long-form copy past about 75 characters a line is
 *  measurably harder to read, whatever the section is called. */
export function sectionNarrow(children: Node[]): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-8', { children })],
    });
}

/**
 * A section's heading, and optionally the sentence under it.
 *
 * The lead is a real 18px paragraph in the base ink, not a faded 14px one. A section
 * introduction is text a visitor is meant to READ, so fading it is the exact move
 * RULE #3 exists to prevent — the hierarchy is already carried by the heading's scale
 * and weight above it.
 */
export function sectionHead(heading: string, lead?: string): Node {
    const children: Node[] = [
        el('h2', 'text-3xl font-semibold text-base-content @3xl:text-4xl', { text: heading }),
    ];
    if (lead) {
        children.push(el('p', 'max-w-2xl text-lg text-base-content', { text: lead }));
    }
    return el('div', 'flex flex-col gap-3', { children });
}

/** A bordered panel on the page surface — the house card. Edge and radius, never a
 *  shadow: a wall of floating cards is the look this design system is built to avoid. */
export function card(cls: string, children: Node[]): Node {
    return el('div', cls, { children });
}

/** The standard card chrome, so twenty different sections cannot each invent their
 *  own border color and radius. */
export const CARD = 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6';
/** The same card on the alternate surface, for use inside a `sectionAlt` band. */
export const CARD_ON_ALT = 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6';

/** A card's own title. `h3` because it sits under the section's `h2` — the outline is
 *  what a screen reader and a search engine read, and skipping a level is a finding
 *  the pre-publish check reports (slice 9). */
export function cardTitle(text: string): Node {
    return el('h3', 'text-xl font-semibold text-base-content', { text });
}

/** Body copy inside a card or a column. 16px, real ink. */
export function body(text: string): Node {
    return el('p', 'text-base text-base-content', { text });
}

/** A genuine caption — a photo credit, a unit, a footnote. This is the one place
 *  `text-sm` is right, because it is text deliberately NOT competing for attention,
 *  which is exactly the test RULE #3 asks you to apply before shrinking anything. */
export function caption(text: string): Node {
    return el('p', 'text-sm text-base-content', { text });
}

/** A primary action. Sized `lg` because a section-level action is a target on a phone
 *  before it is a decoration. */
export function primaryAction(label: string, href = '#'): Node {
    return el('a', 'btn btn-primary btn-lg', { attrs: { href }, text: label });
}

/** A secondary action, for the "or read more" half of a pair. */
export function secondaryAction(label: string, href = '#'): Node {
    return el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href }, text: label });
}

/** A row of one or two actions, wrapping rather than overflowing on a narrow card. */
export function actions(children: Node[]): Node {
    return el('div', 'flex flex-wrap items-center gap-3', { children });
}

/** A responsive grid that collapses to one column on a narrow container. Three
 *  literal variants rather than a computed class, for the `@source` reason above. */
export function gridTwo(children: Node[]): Node {
    return el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2', { children });
}
export function gridThree(children: Node[]): Node {
    return el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', { children });
}
export function gridFour(children: Node[]): Node {
    return el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4', { children });
}

/** A placeholder picture. Every section that shows imagery ships with one, so the
 *  block reads as a real design the moment it is dropped rather than as an empty
 *  frame the author has to imagine their way past. */
export function picture(alt: string, ratio: 'wide' | 'square' = 'wide'): Node {
    // Two ratios, both named utilities. A portrait `aspect-[3/4]` was the obvious third
    // and is exactly the class this platform cannot ship: an ARBITRARY value compiles
    // only where Tailwind SEES it, so it works in this file and emits nothing the moment
    // the tree is stamped into a tenant's database — the failure `checkClassString`
    // exists to catch, which would then report every card this authored.
    const cls =
        ratio === 'square'
            ? 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
            : 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover';
    return el('img', cls, { attrs: { src: '', alt, loading: 'lazy' } });
}

/** A small state chip — "In stock", "Sold out", "New". A real `<Badge>` on a real
 *  thing, never a decorative label introducing a section (RULE #2). */
export function chip(
    text: string,
    color: 'neutral' | 'success' | 'warning' | 'info' = 'neutral'
): Node {
    const cls =
        color === 'success'
            ? 'badge badge-success badge-soft'
            : color === 'warning'
                ? 'badge badge-warning badge-soft'
                : color === 'info'
                    ? 'badge badge-info badge-soft'
                    : 'badge badge-neutral badge-soft';
    return el('span', cls, { text });
}
