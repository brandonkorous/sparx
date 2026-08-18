'use client';

// A bottom sheet that stops ABOVE the nav bar.
//
// ── WHY NOT SILICA'S DRAWER ─────────────────────────────────────────────────
//
// Drawer is modal by construction: it paints at z-10000 and puts `aria-hidden`
// on everything behind it, which is right for a dialog and wrong for this. The
// bar has to stay lit and stay tappable while a sheet is up — you switch from
// Open to All without dismissing anything, and the tab you are in stays filled
// so you can see where you are. A modal cannot do that; painting a bar on top of
// one would make it visible and dead, which is worse than hiding it.
//
// So this is composed chrome, the same as the bar it belongs to: Piggles owns
// the layer, silica owns everything inside it. `DrawerProps` exposes no `modal`
// escape, so the alternative was changing silicaui — a bigger decision than this
// needed.
//
// It is NOT a dialog. Nothing is trapped, nothing behind it is hidden, and the
// work stays readable underneath — which is the point. Escape and the scrim both
// dismiss.

import { useEffect, type ReactNode } from 'react';
import { SheetHandle } from './sheet-handle';

interface SheetProps {
  open: boolean;
  /** Named in the header, and what the sheet is announced as. */
  title: string;
  /** A quiet line on the right of the header — what to do with the list. */
  hint?: string;
  /** Pinned under the scrolling list. The one action about the whole set. */
  footer?: ReactNode;
  children: ReactNode;
  onDismiss: () => void;
}

export function Sheet({ open, title, hint, footer, children, onDismiss }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onDismiss]);

  return (
    <>
      {/* Dims the work without hiding it. Below the sheet, and below the bar. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className={`absolute inset-0 z-10 bg-black/25 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onDismiss}
      />

      <section
        aria-label={title}
        // Anchored to the BOTTOM EDGE, so it reads as rising from it rather
        // than as a card hovering with a strip of page showing underneath. The
        // bar floats ON it — which is why the content below reserves room for
        // one. Piggles owns this panel, so Piggles lifts it (DESIGN.md §4).
        className={`bg-base-200 border-base-300 rounded-box absolute inset-x-0 bottom-0 z-20 flex max-h-[78dvh] flex-col rounded-b-none border border-b-0 shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'pointer-events-none translate-y-[130%]'
        }`}
        // Shut, it is off-screen but still in the tree so the close animates —
        // which is exactly when its rows must stop being reachable by keyboard.
        inert={!open}
      >
        <SheetHandle />

        <header className="flex items-baseline gap-3 px-4 pt-1 pb-3">
          <h2 className="font-display flex-1 text-lg font-semibold">{title}</h2>
          {hint ? <span className="text-base-content text-sm">{hint}</span> : null}
        </header>

        {/* Whichever of these is LAST clears the floating bar. Reserving it on
            both would leave a hole above the footer. */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-2 ${footer ? 'pb-2' : 'pb-24'}`}>
          {children}
        </div>

        {footer ? <div className="border-base-300 border-t p-3 pb-24">{footer}</div> : null}
      </section>
    </>
  );
}
