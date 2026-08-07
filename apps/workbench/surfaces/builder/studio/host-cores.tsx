'use client';

// The canvas preview for a pinned functional core (a `kind:"host"` node).
//
// silica's `renderHostNode` hook asks the host to DRAW a host node on the canvas.
// Two kinds of answer, and the split is about SIZE, not importance:
//
//   · CHROME cores (brand, theme toggle, legal links) — drawn at their REAL size,
//     inline. These live in a navbar or a footer column, and their whole promise is
//     "the platform keeps this filled in for you". A dashed labelled card in a header
//     row is not a preview of them, it is a lie about their footprint: a 24px icon
//     button rendered as a 120px-tall bordered box with three grey bars blows the
//     navbar apart and the author ends up styling around a shape that will never
//     exist. Draw the actual control.
//   · TRANSACTION cores (cart, checkout, search, PLP, booking…) — a labelled,
//     non-interactive SKELETON. The real widget is a live transaction that can't run
//     on a canvas (no cart/session/Stripe), and it legitimately occupies a page-sized
//     block, so showing its FOOTPRINT is the honest preview.
//
// Nothing here is interactive: every chrome preview renders as a <span>, never a real
// <button>/<a>, so a click selects the node in the builder instead of firing the
// control (and a preview toggle can never flip the workbench's own theme).
//
// Without this, silica falls back to its own grey "host component" placeholder box —
// which is exactly the bug this fixes.

import type { BuilderHost } from '@wizeworks/silicaui-builder/react';
import type { HostNode } from '@wizeworks/silicaui-html';
import {
  HOST_COMPONENTS,
  HOST_KEYS,
  frameEmbedSrc,
  frameRatioClass,
  mapEmbedSrc,
  type HostComponentMeta,
} from '@sparx/silica-catalog';

// `HostRenderCtx` isn't re-exported by the builder, so derive the exact hook
// signature from `BuilderHost` — one source of truth, no drift if it changes.
type RenderHostNode = NonNullable<BuilderHost['renderHostNode']>;

/** A neutral placeholder bar, sized by width class. */
function Bar({ w = 'w-full' }: { w?: string }) {
  return <div className={`bg-base-content/10 h-3 rounded ${w}`} />;
}

/** The frame every skeleton sits in — a labelled dashed card that reads as "a live
 *  region your customers see here" without pretending to be interactive. */
function CoreFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-base-content/25 bg-base-100 rounded-lg border border-dashed p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <span className="bg-primary inline-block size-2 rounded-full" />
        {label} · live region
      </div>
      {children}
    </div>
  );
}

/** The tenant's real brand mark — logo and/or name, exactly as the live site's
 *  `site.brand` core renders it, read from the resolver root `site.identity` that
 *  `buildPreviewRoot` overlays. Degrades: logo-only with no logo → the name; no name
 *  → "Your site". Never an empty tile. */
function BrandMark({ root, node }: { root: unknown; node: HostNode }) {
  const identity = (root as { site?: { identity?: { name?: unknown; logo?: unknown } } })?.site
    ?.identity;
  const name = typeof identity?.name === 'string' && identity.name ? identity.name : 'Your site';
  const logo = identity?.logo as { url?: unknown } | null | undefined;
  const logoUrl = typeof logo?.url === 'string' && logo.url ? logo.url : null;
  const show =
    node.props?.show === 'logo' || node.props?.show === 'name' ? node.props.show : 'both';
  // Mirror the live site's degradation: "logo only" with no logo would render an
  // empty box, so fall back to the name.
  const mode = show === 'logo' && !logoUrl ? 'name' : show;

  return (
    <span className="inline-flex items-center gap-2.5">
      {logoUrl && (mode === 'logo' || mode === 'both') ? (
        // A raw <img>, not next/image: an arbitrary tenant media URL (usually an SVG),
        // which the optimizer can't process. Decorative here — the name renders
        // alongside in "both" — so alt is empty.
        <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
      ) : null}
      {mode === 'name' || mode === 'both' ? (
        <span className="text-lg font-semibold">{name}</span>
      ) : null}
    </span>
  );
}

/** The light/dark switch at its real size — the live site mounts an icon button, so
 *  the canvas draws an icon button. A `<span>` carrying the button classes rather than
 *  a `<button>`: it must not be clickable on the canvas (selection belongs to the
 *  builder) and it has no state to show, so the moon glyph stands for the control the
 *  way a light-mode visitor first sees it.
 *
 *  Always drawn, even under a single-theme appearance policy that would hide it live —
 *  a node you cannot see is a node you cannot place, and the palette hint already says
 *  when it appears. Same call the Builder-path `ThemeToggle` canvas node makes. */
function ThemeToggleMark({ hint }: { hint: string }) {
  return (
    <span className="btn btn-ghost btn-sm" title={hint}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  );
}

/** The legal-links column at its real size — a heading plus the links themselves.
 *
 *  The labels are REPRESENTATIVE, not the tenant's own: unlike `site.brand`, whose data
 *  is already in the canvas resolver root, legal placements are a separate read the
 *  studio doesn't make. Three of the six kinds, in the order the checklist lists them,
 *  so the author sees the column's true shape and rhythm. What actually renders is
 *  whatever they've published (and nothing at all until they publish one) — the `title`
 *  says so, and so does the palette hint. */
function LegalLinksColumn({ heading, hint }: { heading: string; hint: string }) {
  return (
    // Its own flex column rather than `display:contents`, which generates no box and
    // so would swallow the tooltip. Nesting a column inside the node's own column
    // costs nothing visually.
    <span className="flex flex-col gap-3" title={hint}>
      {heading ? <h3 className="text-sm font-semibold">{heading}</h3> : null}
      {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((label) => (
        <span key={label} className="text-sm">
          {label}
        </span>
      ))}
    </span>
  );
}

/** The page-links pager at its real size — Prev, a short run of numbers with the
 *  current one filled, Next.
 *
 *  Representative, and it has to be: on the live site this control renders NOTHING
 *  until there is more than one page of something, and drawing an empty box on the
 *  canvas would make an author think they had placed it wrong. So the canvas shows
 *  the shape it takes when it does appear, and the `title` says what decides that. */
function PagerMark({ hint }: { hint: string }) {
  return (
    <span className="flex flex-wrap items-center justify-center gap-2" title={hint}>
      <span className="btn btn-ghost btn-sm">← Prev</span>
      {['1', '2', '3'].map((n) => (
        <span key={n} className={n === '1' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
          {n}
        </span>
      ))}
      <span className="btn btn-ghost btn-sm">Next →</span>
    </span>
  );
}

/**
 * A map or a general embed at its REAL footprint.
 *
 * Sized rather than skeletal, and that is the whole point: the author's only decision
 * here is how big a hole this leaves in their layout, and a dashed card of some other
 * height answers the wrong question. So it draws the real ratio box, the real rounding,
 * the real surface.
 *
 * NOT the live frame, though. A third-party iframe on the canvas would run someone
 * else's scripts inside the builder, reload on every keystroke that re-renders, and
 * swallow the clicks that are supposed to SELECT the block.
 *
 * The UNRESOLVED state is the one that earns its words. Both of these render NOTHING on
 * the live site until their field is filled in, so a silent grey box here would read as
 * "placed wrong" when the truth is "not finished yet". It says which — the same sentence
 * the pre-publish check uses.
 */
function FrameMark({ node, meta }: { node: HostNode; meta?: HostComponentMeta }) {
  const props = node.props ?? {};
  const isMap = node.component === HOST_KEYS.siteMap;
  const resolved = isMap
    ? mapEmbedSrc(props.location, props.zoom) !== null
    : frameEmbedSrc(props.url) !== null;

  return (
    <span
      className={`rounded-box bg-base-200 text-base-content flex w-full items-center justify-center border p-6 text-center ${frameRatioClass(
        props.ratio
      )} ${resolved ? 'border-base-300' : 'border-base-content/25 border-dashed'}`}
      title={meta?.hint ?? node.component}
    >
      <span className="text-sm font-medium">
        {resolved
          ? `${isMap ? 'Map' : 'Embed'} · shows here`
          : isMap
            ? 'Type your address in the Map panel to show it here'
            : 'Paste a link in the Embed panel to show it here'}
      </span>
    </span>
  );
}

/** Build the studio's `renderHostNode`, closing over the canvas resolver root so the
 *  brand core can draw the tenant's real mark. Every other core draws a labelled
 *  skeleton keyed by its `component`; a registered-but-unhandled key still renders a
 *  labelled frame, so a new core is always at least legible. */
export function makeRenderHostNode(root: unknown): RenderHostNode {
  return function renderHostNode(node) {
    const meta = HOST_COMPONENTS.find((c) => c.key === node.component);
    const label = meta?.label ?? node.component;
    // Chrome cores draw at their real size — a dashed CoreFrame in a navbar row or a
    // footer column misrepresents their footprint badly enough to make the surrounding
    // layout unstylable. See the header note.
    if (node.component === HOST_KEYS.siteBrand) {
      return <BrandMark root={root} node={node} />;
    }
    if (node.component === HOST_KEYS.siteThemeToggle) {
      return <ThemeToggleMark hint={meta?.hint ?? label} />;
    }
    if (node.component === HOST_KEYS.sitePagination) {
      return <PagerMark hint={meta?.hint ?? label} />;
    }
    if (node.component === HOST_KEYS.siteMap || node.component === HOST_KEYS.siteEmbed) {
      return <FrameMark node={node} {...(meta ? { meta } : {})} />;
    }
    if (node.component === HOST_KEYS.siteLegalLinks) {
      return (
        <LegalLinksColumn
          heading={typeof node.props?.heading === 'string' ? node.props.heading : 'Legal'}
          hint={meta?.hint ?? label}
        />
      );
    }
    return (
      <CoreFrame label={label}>
        <div className="space-y-3">
          <Bar w="w-1/2" />
          <Bar w="w-full" />
          <Bar w="w-3/4" />
        </div>
      </CoreFrame>
    );
  };
}
