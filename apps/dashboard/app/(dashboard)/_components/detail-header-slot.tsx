'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

// ── Detail chrome teleports (header + footer) ──────────────
// A detail surface's BODY is server-rendered and mounted in three different
// frames — the drawer chrome, the modal chrome, and the full-page shell — and
// each frame owns the bars ABOVE (header) and BELOW (footer) the scrolling body.
// These let the body declare that chrome ONCE and have it render in whichever
// frame is active:
//   • header slot — status + lifecycle actions (so the body never restates the
//     entity's name/handle as an in-body header — the redundancy this removes).
//   • footer slot — the form's primary Save, pinned to the frame's floor OUTSIDE
//     the scrolling body. A `position: sticky` bar INSIDE the scroll body can't
//     pin to the modal's bottom edge (it scrolls with its content); rendering it
//     as a sibling after the scroll area in each frame is what actually floors it.
//
// The active frame renders <DetailHeaderSlotTarget/> / <DetailFooterSlotTarget/>
// in its bars; the body renders <DetailHeaderSlot>/<DetailFooterSlot> anywhere it
// likes and the children portal into the matching target. Separate set/node
// context pairs keep each registering ref callback stable: the setter identity
// never changes, so a node change can't re-run the ref and thrash detach/attach.
//
// Because the footer portals OUT of the body's <form>, a Save button there must
// associate back via the HTML `form="<id>"` attribute (DOM submission follows DOM
// ancestry, not the React tree) — give the form an id and the button `form={id}`.

const HeaderSetContext = React.createContext<((node: HTMLElement | null) => void) | null>(null);
const HeaderNodeContext = React.createContext<HTMLElement | null>(null);
const FooterSetContext = React.createContext<((node: HTMLElement | null) => void) | null>(null);
const FooterNodeContext = React.createContext<HTMLElement | null>(null);

export function DetailChromeProvider({ children }: { children: React.ReactNode }) {
  const [headerNode, setHeaderNode] = React.useState<HTMLElement | null>(null);
  const [footerNode, setFooterNode] = React.useState<HTMLElement | null>(null);
  return (
    <HeaderSetContext.Provider value={setHeaderNode}>
      <HeaderNodeContext.Provider value={headerNode}>
        <FooterSetContext.Provider value={setFooterNode}>
          <FooterNodeContext.Provider value={footerNode}>{children}</FooterNodeContext.Provider>
        </FooterSetContext.Provider>
      </HeaderNodeContext.Provider>
    </HeaderSetContext.Provider>
  );
}

function useTargetRef(ctx: React.Context<((node: HTMLElement | null) => void) | null>) {
  const setNode = React.useContext(ctx);
  return React.useCallback(
    (el: HTMLElement | null) => {
      setNode?.(el);
    },
    [setNode]
  );
}

// Rendered by the active frame's header bar. Registers its element as the portal
// target for whatever the body teleports in. An empty target is a zero-width
// flex child, so frames whose body supplies no header content are unaffected.
// `data-slot="lifecycle"` lets the frame's own zone-divider (see
// `detail-panel.tsx` / `detail-page-shell.tsx`) detect via CSS `:has()` /
// `:empty` whether this zone is actually populated, without any JS state.
export function DetailHeaderSlotTarget({ className }: { className?: string }) {
  const ref = useTargetRef(HeaderSetContext);
  return <div ref={ref} data-slot="lifecycle" className={className} />;
}

// Rendered by the active frame BELOW its scrolling body. Empty (zero-height)
// until a body teleports a footer in, so frames/tabs without a Save show no bar.
// `data-slot="formactions"` — see `DetailHeaderSlotTarget` above.
export function DetailFooterSlotTarget({ className }: { className?: string }) {
  const ref = useTargetRef(FooterSetContext);
  return <div ref={ref} data-slot="formactions" className={className} />;
}

// Rendered by the detail body. Portals its children into the active frame's
// header slot; renders nothing until a frame has registered a target (the first
// server pass, before hydration, has no target yet).
export function DetailHeaderSlot({ children }: { children: React.ReactNode }) {
  const node = React.useContext(HeaderNodeContext);
  if (!node) return null;
  return createPortal(children, node);
}

// Rendered by the detail body. Portals its children into the active frame's
// floored footer slot (same hydration caveat as the header slot).
export function DetailFooterSlot({ children }: { children: React.ReactNode }) {
  const node = React.useContext(FooterNodeContext);
  if (!node) return null;
  return createPortal(children, node);
}

// Imperative escape hatch for a body that needs the raw target node rather
// than portaling children itself — e.g. handing it to `SurfaceFrame`'s
// `actionsTarget` prop so the create wizard's own action row merges into
// THIS slot instead of the frame rendering a second toolbar bar underneath it.
export function useDetailFooterNode(): HTMLElement | null {
  return React.useContext(FooterNodeContext);
}
