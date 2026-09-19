'use client';

// The canvas preview for a pinned functional core (a `kind:"host"` node).
//
// silica's `renderHostNode` hook asks the host to DRAW a host node on the canvas.
// Two kinds of answer, and the split is about SIZE, not importance:
//
//   · CHROME cores — drawn at their REAL size, inline. They live in a navbar or a footer
//     column, and their whole promise is "the platform keeps this filled in for you".
//     The marks are in `host-core-marks.tsx`.
//
//     WHICH ONES: everything the catalog files under the "Your site" category, plus the
//     two under "Your media". That is a fact in the catalog, not a list kept here — this
//     comment used to name the six that had marks, and the seventh ("Social links") sat
//     in a footer column drawn as a page-sized skeleton for exactly as long as the list
//     went unread. `pnpm check:host-cores` now asserts the coverage and prints the
//     denominator, so a core added to the catalog reddens the build rather than landing
//     on a canvas as a grey box.
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
  SaveForLaterMark,
  SocialLinksMark,
  ThemeToggleMark,
} from './host-core-marks';

// `HostRenderCtx` isn't re-exported by the builder, so derive the exact hook
// signature from `BuilderHost` — one source of truth, no drift if it changes.
type RenderHostNode = NonNullable<BuilderHost['renderHostNode']>;

/** A neutral placeholder bar, sized by width class. */
function Bar({ w = 'w-full' }: { w?: string }) {
  return <div className={`bg-base-content/10 h-3 rounded ${w}`} />;
}

/** The frame every skeleton sits in — a labelled dashed card that says the real thing
 *  appears here without pretending to be interactive.
 *
 *  THE LABEL IS IN HER WORDS. It used to end "· live region", which is a screen-reader
 *  term borrowed to mean "the platform fills this in". A shop owner has no reason to
 *  know it, and the question she is actually asking, standing in front of a dashed box
 *  full of grey bars, is whether her customers are going to see THIS. They are not, and
 *  now the label says so. Same voice as `FrameMark`'s "Your map shows here". */
function CoreFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-base-content/25 bg-base-100 rounded-lg border border-dashed p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <span className="bg-primary inline-block size-2 rounded-full" />
        {label} · the real one shows on your site
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
    if (node.component === HOST_KEYS.siteSocialLinks) {
      return <SocialLinksMark root={root} hint={hint} />;
    }
    // Filed under "Your shop", but the size rule above is what decides how it draws,
    // and this one is a single control beside the Add-to-cart button.
    if (node.component === HOST_KEYS.commerceProductSave) {
      return (
        <SaveForLaterMark
          hint={hint}
          label={typeof node.props?.label === 'string' ? node.props.label : 'Save for later'}
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
