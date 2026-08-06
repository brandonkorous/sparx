// Shared INTERACTIVE-section helpers for the ten reference-driven template blueprints
// (docs/templates/*). Phase 2c — the behaviours pass. Where a reference store's home page
// genuinely MOVES (a rotating hero, a live sale clock, a scrolling promo ticker), the
// authored section carries the matching silica behaviour marker so the storefront's
// `@wizeworks/silicaui-behaviors` runtime hydrates it on publish. The static markup already
// reads correctly UNHYDRATED (first slide shown, clock frozen at its authored value), so a
// page that never hydrates still degrades to a sensible design — the platform contract.
//
// These wrap the SAME `behave`/`part` primitives the shipped catalog section
// `galleryShowcase` (packages/silica-catalog/src/sections/gallery.ts) already uses, so the
// marker contract lives in one reviewed place. The runtime finds the track / slides /
// controls by their `part` MARKER, never by class, so the controls are styled with plain
// `btn` + layout utilities (which resolve on every surface, including the flat preview
// build) rather than the silica `carousel-*` plugin classes (which the storefront styles but
// the preview build does not emit). The `‹`/`›` glyphs are text, not the Icon atom — silica
// ships no left/right chevron.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules);
// the primitives come through the silica-catalog package's own copy so the nodes minted here
// and the nodes the catalog factories mint are the same module instance.

import {
  atom,
  behave,
  el,
  part,
  type Node,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

/**
 * A full-bleed autoplaying hero VIDEO backdrop — the silica `Video` component sized to fill
 * its section, exactly where a static hero would place its `<img>`. Where the reference store
 * genuinely leads with motion (Gymshark's ride film, a runway campaign, a cinematic product
 * reel), the template's hero swaps its `<img>` backdrop for this and keeps the rest of its
 * readable overlay panel unchanged.
 *
 * `muted` + `playsinline` are what let a browser autoplay it at all; `loop` keeps it running;
 * `poster` is the SAME still the hero used before, so the hero is never blank — it shows the
 * photograph until the first frame decodes, and KEEPS showing it if the clip is slow, blocked,
 * or a visitor prefers reduced motion (the browser honours that for autoplay). The clip is
 * self-hosted under the storefront's own `/video/*` (ship-safe, same-origin — no hot-link),
 * so worst case a visitor sees the exact hero they'd see today.
 */
export function videoBackdrop(o: { src: string; poster: string; posterAlt: string }): Node {
  return atom('Video', 'absolute inset-0 h-full w-full object-cover', {
    src: o.src,
    poster: o.poster,
    autoplay: true,
    muted: true,
    loop: true,
    playsinline: true,
    // A hero video the visitor did not ask for should not block the page on a phone data
    // plan; metadata is enough to start the muted autoplay, and the poster covers the gap.
    preload: 'metadata',
    // Native <video> ignores alt, but the poster IS the accessible image; kept on the node so
    // the bundle's asset registry still documents what the still depicts.
    'aria-label': o.posterAlt,
  });
}

/**
 * A rotating hero — a `carousel` of full-bleed slides that advance on their own, with the
 * canonical prev/next controls and a dot pager a visitor can grab. This is the ONE hero
 * shape that earns its JavaScript: the slides move themselves, which no CSS arrangement can
 * do. Autoplay is suppressed in the editor canvas and for anyone who prefers reduced motion —
 * the engine handles both — and the root is `overflow-hidden`, so unhydrated the page shows
 * the first slide cleanly rather than a row of stacked heroes.
 *
 * Each `slide` is a caller-authored full-bleed band, wrapped `w-full shrink-0` so the flex
 * track shows exactly one at a time. Prev/next are real silica buttons (never a re-skin) in a
 * non-interactive overlay rail, so they float over the imagery without blocking the readable
 * panel beneath. `interval` is MILLISECONDS (engine default 5000). Six seconds by default: a
 * hero slide a visitor is reading should not vanish mid-sentence.
 */
export function heroCarousel(slides: Node[], opts: { intervalMs?: number } = {}): Node {
  const interval = opts.intervalMs ?? 6000;
  const arrow = (glyph: string, label: string, role: 'prev' | 'next'): Node =>
    part(
      el('button', 'btn btn-neutral btn-circle pointer-events-auto text-xl leading-none', {
        attrs: { type: 'button', 'aria-label': label },
        text: glyph,
      }),
      role
    );
  const track = part(
    el('div', 'flex', {
      children: slides.map((slide) =>
        part(el('div', 'w-full shrink-0', { children: [slide] }), 'slide')
      ),
    }),
    'track'
  );
  return behave(
    el('div', 'relative @container overflow-hidden bg-base-200', {
      children: [
        track,
        // A non-interactive overlay rail down both edges; only the buttons take pointer
        // events, so the readable panel underneath stays fully clickable between them.
        el(
          'div',
          'pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 @3xl:px-6',
          {
            children: [
              arrow('‹', 'Previous slide', 'prev'),
              arrow('›', 'Next slide', 'next'),
            ],
          }
        ),
      ],
    }),
    { type: 'carousel', params: { autoplay: true, interval } }
  );
}

/**
 * A TABBED showcase — a `tabs` pill row that swaps between panels in place (the
 * "NEW / BEST SELLERS / GIFTS" reslice a beauty/retail home leads with). Mirrors the silica
 * `Tabs` component: a `tabs-list` of `tabs-tab` buttons over `tabs-panel`s, the whole thing a
 * `tabs`-behaviour root in the `pills` variant — so the active tab is a FILLED shape
 * (`.tabs-tab[data-active]`, which the runtime toggles), never a 2px underline (DESIGN §4).
 *
 * Panels are left VISIBLE in source (progressive enhancement — the silica component's own
 * contract): a no-JS reader gets every panel's content stacked, and the runtime hides the
 * inactive ones on hydrate. Pass an optional `heading` node to sit above the pill row.
 */
export function tabbedShowcase(
  tabs: { label: string; panel: Node }[],
  opts: { heading?: Node } = {}
): Node {
  const list = el('div', 'tabs-list flex flex-wrap gap-2', {
    attrs: { role: 'tablist' },
    children: tabs.map((t) =>
      part(
        el('button', 'tabs-tab', { attrs: { type: 'button', role: 'tab' }, text: t.label }),
        'tab'
      )
    ),
  });
  const panels = tabs.map((t) =>
    part(el('div', 'tabs-panel', { attrs: { role: 'tabpanel' }, children: [t.panel] }), 'panel')
  );
  return behave(
    el('div', 'tabs tabs-pills flex flex-col gap-8', {
      children: [...(opts.heading ? [opts.heading] : []), list, ...panels],
    }),
    { type: 'tabs' }
  );
}
