'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

// ── Detail header teleport ─────────────────────────────────
// A detail surface's BODY is server-rendered and mounted in three different
// frames — the drawer chrome, the modal chrome, and the full-page shell — and
// each frame owns the header bar at the top. This lets the body declare its
// header content (status + primary lifecycle actions) ONCE and have it render in
// whichever frame is active, instead of restating the entity's name/handle as an
// in-body header (which would just duplicate the editable Title/Handle fields —
// the redundancy this pattern exists to remove).
//
// The active frame renders <DetailHeaderSlotTarget/> in its header bar; the body
// renders <DetailHeaderSlot>{actions}</DetailHeaderSlot> anywhere it likes, and
// the children portal into the target. Two contexts (not one) keep the
// registering ref callback stable: the setter identity never changes, so a node
// change can't re-run the ref and thrash it detach/attach.

const SlotSetContext = React.createContext<((node: HTMLElement | null) => void) | null>(null);
const SlotNodeContext = React.createContext<HTMLElement | null>(null);

export function DetailChromeProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  return (
    <SlotSetContext.Provider value={setNode}>
      <SlotNodeContext.Provider value={node}>{children}</SlotNodeContext.Provider>
    </SlotSetContext.Provider>
  );
}

// Rendered by the active frame's header bar. Registers its element as the portal
// target for whatever the body teleports in. An empty target is a zero-width
// flex child, so frames whose body supplies no header content are unaffected.
export function DetailHeaderSlotTarget({ className }: { className?: string }) {
  const setNode = React.useContext(SlotSetContext);
  const ref = React.useCallback(
    (el: HTMLElement | null) => {
      setNode?.(el);
    },
    [setNode]
  );
  return <div ref={ref} className={className} />;
}

// Rendered by the detail body. Portals its children into the active frame's
// header slot; renders nothing until a frame has registered a target (the first
// server pass, before hydration, has no target yet).
export function DetailHeaderSlot({ children }: { children: React.ReactNode }) {
  const node = React.useContext(SlotNodeContext);
  if (!node) return null;
  return createPortal(children, node);
}
