'use client';

// The canvas preview for a pinned functional core (a `kind:"host"` node).
//
// silica's `renderHostNode` hook asks the host to DRAW a host node on the canvas.
// Two kinds of answer, and the split is about SIZE, not importance:
//
//   · CHROME cores (brand, theme toggle, account link, legal links, pager, embeds) —
//     drawn at their REAL size, inline. They live in a navbar or a footer column, and
//     their whole promise is "the platform keeps this filled in for you". The marks are
//     in `host-core-marks.tsx`.
//   · TRANSACTION cores (cart, checkout, search, PLP, booking…) — a labelled,
//     non-interactive SKELETON. The real widget is a live transaction that can't run
//     on a canvas (no cart/session/Stripe), and it legitimately occupies a page-sized
//     block, so showing its FOOTPRINT is the honest preview.
//
// Without this, silica falls back to its own grey "host component" placeholder box —
// which is exactly the bug this fixes.

import type { BuilderHost } from '@wizeworks/silicaui-builder/react';
import { HOST_COMPONENTS, HOST_KEYS } from '@wizeworks/silica-catalog';

import {
  AccountLinkMark,
  BrandMark,
  FrameMark,
  LegalLinksColumn,
  PagerMark,
  ThemeToggleMark,
} from './host-core-marks';

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

/** Build the studio's `renderHostNode`, closing over the canvas resolver root so the
 *  brand core can draw the tenant's real mark. Every other core draws a labelled
 *  skeleton keyed by its `component`; a registered-but-unhandled key still renders a
 *  labelled frame, so a new core is always at least legible. */
export function makeRenderHostNode(root: unknown): RenderHostNode {
  return function renderHostNode(node) {
    const meta = HOST_COMPONENTS.find((c) => c.key === node.component);
    const label = meta?.label ?? node.component;
    const hint = meta?.hint ?? label;
    // Chrome cores draw at their real size — a dashed CoreFrame in a navbar row or a
    // footer column misrepresents their footprint badly enough to make the surrounding
    // layout unstylable. See the header note.
    if (node.component === HOST_KEYS.siteBrand) {
      return <BrandMark root={root} node={node} />;
    }
    if (node.component === HOST_KEYS.siteThemeToggle) {
      return <ThemeToggleMark hint={hint} />;
    }
    if (node.component === HOST_KEYS.siteAccountLink) {
      return <AccountLinkMark hint={hint} />;
    }
    if (node.component === HOST_KEYS.sitePagination) {
      return <PagerMark hint={hint} />;
    }
    if (node.component === HOST_KEYS.siteMap || node.component === HOST_KEYS.siteEmbed) {
      return <FrameMark node={node} {...(meta ? { meta } : {})} />;
    }
    if (node.component === HOST_KEYS.siteLegalLinks) {
      return (
        <LegalLinksColumn
          heading={typeof node.props?.heading === 'string' ? node.props.heading : 'Legal'}
          hint={hint}
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
