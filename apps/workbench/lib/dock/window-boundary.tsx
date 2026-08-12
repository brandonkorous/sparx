'use client';

// Which window is this UI actually in?
//
// dockview popouts move a group's DOM into a child window while its React tree
// stays in the main window — which breaks every portalled surface: Base UI
// portals to `document.body`, and `document` is the main window's document even
// when the trigger is on a second monitor. A menu opened in the popout appears
// in the opener. silicaui grew `PortalContainerProvider` for exactly this
// (authored alongside this file); the boundary below feeds it the right body
// by watching which document the pane's own DOM node belongs to.
//
// Toasts and the imperative confirm get per-pane providers here for the same
// reason: the root providers render into the main window, so a save confirmed
// from a popout would toast a monitor away from where the operator is looking.
// The cost is that two panes toasting at the SAME moment draw two stacks in
// one corner instead of one merged stack — rare, cosmetic, and a fair trade
// for outcomes always announcing themselves in the acting window.
//
// Two DIFFERENT containers are in play, and the distinction matters:
//   • Transient surfaces (menus, selects, tooltips, popovers) portal to the
//     pane's WINDOW body. They must be free to overflow the pane — a select
//     opened at the bottom edge of a short pane has to spill past it, not get
//     clipped to nothing.
//   • Dialogs portal to the pane ELEMENT (see PaneScope below), so a modal
//     opened from one document in this multi-document interface dims and
//     covers THAT pane rather than the whole app.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { ImperativeAlertDialogProvider, PortalContainerProvider } from '@wizeworks/silicaui-react';

/** The slice of dockview's panel/group api the boundary needs — both expose it. */
interface LocationAwareApi {
  onDidLocationChange(listener: (event: unknown) => void): { dispose(): void };
  onDidGroupChange?(listener: (event: unknown) => void): { dispose(): void };
}

/**
 * Tracks the document that owns `host`'s DOM node. Returns `null` while it is
 * the main document — so callers can hand the value straight to the portal
 * provider, where `null` means "default behaviour".
 */
export function useOwnerWindowBody(
  host: RefObject<HTMLElement | null>,
  api: LocationAwareApi
): HTMLElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const read = () => {
      const body = host.current?.ownerDocument.body ?? null;
      setContainer(body && body !== document.body ? body : null);
    };
    // dockview fires location events around the DOM move, not strictly after
    // it — read now and again shortly after, settling on the final document.
    // Re-running into the same value is a no-op for React state.
    const resync = () => {
      read();
      setTimeout(read, 0);
      setTimeout(read, 150);
    };
    resync();
    const subs = [api.onDidLocationChange(resync), api.onDidGroupChange?.(resync)];
    return () => {
      for (const sub of subs) sub?.dispose();
    };
  }, [api, host]);

  return container;
}

/**
 * The pane's own host element, for surfaces that should be CONFINED to the pane
 * rather than merely follow its window. Null outside a pane (the shell's own
 * chrome), where "the whole window" is the honest scope.
 */
const PaneElementContext = createContext<HTMLElement | null>(null);

/**
 * Scopes silica's portalled surfaces to the pane this component renders in.
 *
 * Wrap a `<Dialog>` in this and its backdrop covers only the pane that opened
 * it. That works because the pane host establishes a containing block (the
 * `transform-gpu` below), which is what re-anchors the dialog's `position:
 * fixed` backdrop and popup from the viewport to the pane box.
 *
 * Deliberately opt-in per dialog rather than applied to the whole pane subtree:
 * menus and tooltips need the opposite treatment (see the header note).
 */
export function PaneScope({ children }: { children: ReactNode }) {
  const paneElement = useContext(PaneElementContext);
  return <PortalContainerProvider container={paneElement}>{children}</PortalContainerProvider>;
}

interface PaneWindowBoundaryProps {
  api: LocationAwareApi;
  children: ReactNode;
}

/**
 * Wraps a pane's content so its overlays — menus, selects, dialogs, tooltips,
 * confirms — render in whichever window the pane currently occupies.
 * The provider structure is IDENTICAL docked and detached (only the container
 * value changes): a branch that added or removed wrappers on tear-off would
 * remount the surface and wipe its unsaved state mid-drag.
 *
 * NOT toasts — those are app-wide, from the single provider in app/layout.tsx.
 * A `ToastProvider` here mounted one per PANE, and silica's provider always
 * renders its own viewport, so a dozen open panes meant a dozen
 * `role="region" aria-live="polite"` landmarks all named "Notifications" stacked
 * at the same fixed corner: landmark navigation was useless, and two panes
 * toasting at once overlapped instead of stacking.
 */
export function PaneWindowBoundary({ api, children }: PaneWindowBoundaryProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const container = useOwnerWindowBody(host, api);
  // A ref alone can't drive PaneScope — context has to re-render its consumers
  // once the node exists, and a ref mutation doesn't. So the element is state,
  // set from a callback ref that also keeps `host` populated for the effect.
  const [paneElement, setPaneElement] = useState<HTMLElement | null>(null);

  return (
    // `transform-gpu` is load-bearing, not a performance hint: a transformed
    // element is a containing block for fixed-position descendants, which is
    // what confines a PaneScope'd dialog to this pane. Harmless for everything
    // else, since every other portalled surface leaves this subtree entirely.
    <div
      ref={(node) => {
        host.current = node;
        setPaneElement(node);
      }}
      className="h-full min-h-0 transform-gpu"
    >
      <PortalContainerProvider container={container}>
        <PaneElementContext.Provider value={paneElement}>
          {/* Confirms stay per-pane: a confirm belongs to the action that raised
              it and must appear over that pane, in that pane's window. Toasts
              are the opposite — one app-wide stack (see the note above). */}
          <ImperativeAlertDialogProvider>{children}</ImperativeAlertDialogProvider>
        </PaneElementContext.Provider>
      </PortalContainerProvider>
    </div>
  );
}

/**
 * Same idea for chrome OUTSIDE a pane (the group header's tear-off button):
 * wraps children in the portal provider only — chrome has no toasts of its own.
 */
export function ChromeWindowBoundary({ api, children }: PaneWindowBoundaryProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const container = useOwnerWindowBody(host, api);

  return (
    <div ref={host} className="flex h-full items-center gap-0.5 pr-1">
      <PortalContainerProvider container={container}>{children}</PortalContainerProvider>
    </div>
  );
}
