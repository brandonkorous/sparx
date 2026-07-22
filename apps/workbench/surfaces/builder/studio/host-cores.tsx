'use client';

// The canvas preview for a pinned functional core (a `kind:"host"` node).
//
// silica's `renderHostNode` hook asks the host to DRAW a host node on the canvas.
// Two kinds of answer:
//   · site.brand — the tenant's REAL mark, inline (logo and/or name), read from the
//     resolver root `site.identity` that preview-data overlays. NOT a skeleton: the
//     whole point of the core is "your logo shows up automatically", so a grey box
//     here would be worse than useless — and the data is already in the root.
//   · every other core (cart, checkout, search, PLP, booking…) — a labelled,
//     non-interactive SKELETON: the real widget is a live transaction that can't run
//     on a canvas (no cart/session/Stripe), so we show its FOOTPRINT so the author
//     can style around it.
//
// Without this, silica falls back to its own grey "host component" placeholder box —
// which is exactly the bug this fixes.

import type { BuilderHost } from '@wizeworks/silicaui-builder/react';
import type { HostNode } from '@wizeworks/silicaui-html';
import { HOST_COMPONENTS, HOST_KEYS } from '@sparx/silica-catalog';

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
      <div className="text-base-content mb-4 flex items-center gap-2 text-sm font-medium">
        <span className="bg-primary inline-block size-2 rounded-full" />
        {label} · live region
      </div>
      {children}
    </div>
  );
}

/** The tenant's real brand mark — logo and/or name, exactly as the storefront's
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
  // Mirror the storefront's degradation: "logo only" with no logo would render an
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
        <span className="text-base-content text-lg font-semibold">{name}</span>
      ) : null}
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
    // The brand sits inline in the navbar; wrapping it in a labelled dashed box would
    // misrepresent its real footprint, so it gets no CoreFrame.
    if (node.component === HOST_KEYS.siteBrand) {
      return <BrandMark root={root} node={node} />;
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
