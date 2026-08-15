'use client';

// The beta heads-up a module wears on EVERY one of its surfaces.
//
// WHERE IT SITS, and why that took two goes: directly UNDER the pane's toolbar, as a
// sibling card in PANE_SHELL's flex column, so it picks up the shell's own gap and the
// house "floating cards on a recessed pane" pattern for free.
//
// Above the toolbar — where this first went, because SurfaceMount was the convenient
// mount point — was wrong three ways. It wedged a banner between the dock tab and the
// toolbar, which both name the pane, orphaning the header from its own tab. It pushed
// Refresh / New post / the filters down, then back up on dismiss, across every pane. And
// it forced this file to re-implement PANE_SHELL's gutter from outside the shell, which
// is the tell that the mount point was wrong rather than the padding.
//
// The general rule: chrome that says where you are and what you can do stays anchored; a
// notice that qualifies the CONTENT goes between that chrome and the content. Contrast
// billing/billing-banner.tsx, which is about the account rather than any one pane and so
// correctly sits above all pane chrome.
//
// WHY IT MOUNTS FROM PaneToolbar rather than from each surface: the workbench is a dock,
// not a page stack — a surface is opened from the command palette, a restored layout, a
// deep link or a drop into another window, so there is no landing surface every route
// passes through. One seam here covers every surface of a beta module, including ones
// added later. The known gap is a branch that renders PANE_SHELL with no toolbar at all
// (a few surfaces' load-failed states); those show no notice, which is an acceptable
// trade for not touching sixty surfaces.
//
// The copy stays GENERIC on purpose — no platform named, no capability claimed. A
// specific claim about a third party's API is a hardcoded assertion nothing here can
// verify, which goes stale silently and then has to be hunted down. "Expect some rough
// edges" is true for the whole beta regardless of who approves what.
//
// Ending a beta: drop the module from BETA_MODULES (lib/surfaces/nav.ts) and its entry
// below. Deleting this file outright also removes the two call sites' imports, so the
// compiler names them — there is nothing to hunt for.

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';
import { Info } from 'lucide-react';
import type { WorkbenchModule } from './module-scope';
import { isBetaModule } from '../lib/surfaces/nav';
import { productCopy } from '../lib/product';

interface BetaNotice {
  title: string;
  /** One paragraph each. Lead with what to expect; close with what is safe. */
  body: readonly [string, string];
}

const BETA_NOTICES: Partial<Record<WorkbenchModule, BetaNotice>> = {
  social: {
    title: 'Social is in beta',
    body: [
      productCopy(
        'social.beta.notice',
        'The social networks are still reviewing Piggles’ access to post on your behalf, so expect some rough edges for now: an account may not connect yet, a post can sit in the queue longer than you expect, and numbers or comments may be incomplete or slow to appear.'
      ),
      'Everything you write, schedule and plan is kept. As each network approves us, your queue starts going out to it — you will not have to redo anything.',
    ],
  },
};

/* ── Which module the surrounding pane belongs to ─────────────────────────── */

// SurfaceMount knows this; PaneToolbar is rendered deep inside a surface and does not.
// Context rather than a prop so no surface has to pass its own module down to its own
// toolbar — a chore every one of them would have to remember, forever, for a banner
// they have nothing to do with. Renders no DOM, so it does not disturb the pane.
const PaneModuleContext = createContext<WorkbenchModule | null>(null);

export function PaneModuleProvider({
  module,
  children,
}: {
  module: WorkbenchModule;
  children: ReactNode;
}) {
  return <PaneModuleContext.Provider value={module}>{children}</PaneModuleContext.Provider>;
}

/* ── Dismissal, shared across every open pane ─────────────────────────────── */

// Now that this renders on every surface of a module, dismissal has to be one decision,
// not one per pane: with Calendar and Inbox side by side, closing one and leaving the
// other sitting there looks broken. So the state lives module-side of React and every
// mounted notice subscribes to it.
const KEY = 'piggles-console-beta-read';

function readAll(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

let dismissed: Set<string> | null = null;
const listeners = new Set<() => void>();

function current(): Set<string> {
  dismissed ??= readAll();
  return dismissed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // A torn-off pane portals into another document but runs in THIS JS context, so the
  // notify loop already covers it. This covers the genuinely separate case: the
  // workbench open in a second browser tab, which is its own context and only learns
  // about the write through a storage event.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    dismissed = readAll();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function dismiss(module: WorkbenchModule): void {
  const next = new Set(current());
  next.add(module);
  dismissed = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // Storage full or blocked — the dismissal still holds for this session.
    }
  }
  for (const listener of listeners) listener();
}

function useDismissed(module: WorkbenchModule | null): boolean {
  const getSnapshot = useCallback(() => (module ? current().has(module) : true), [module]);
  // Server render says "not dismissed" and the client corrects on hydration — the
  // alternative is reading localStorage during render, which cannot work on the server.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/* ── The notice ───────────────────────────────────────────────────────────── */

/**
 * Rendered by PaneToolbar, immediately beneath the bar. Returns null for any pane whose
 * module is not in beta, which is nearly all of them — the cost to everything else is
 * one context read.
 */
export function PaneBetaNotice() {
  const module = useContext(PaneModuleContext);
  const isDismissed = useDismissed(module);

  if (!module || isDismissed || !isBetaModule(module)) return null;
  const notice = BETA_NOTICES[module];
  if (!notice) return null;

  return (
    // `shrink-0` because PANE_SHELL is a flex column whose content child grows — without
    // it a long notice would be squeezed by the pane beneath rather than keeping its
    // height. `role="status"` (polite) not the default `alert` (assertive): this is
    // standing context, not something that just went wrong.
    //
    // `dismissible` is Alert's own — it renders the close button and animates the notice
    // away. Never hand-roll a ghost × beside AlertContent for this.
    <Alert
      color="info"
      variant="soft"
      role="status"
      className="shrink-0"
      dismissible
      onDismiss={() => {
        dismiss(module);
      }}
    >
      <Info aria-hidden />
      <AlertContent>
        <AlertTitle>{notice.title}</AlertTitle>
        <AlertDescription>
          <Text className="text-sm">{notice.body[0]}</Text>
          <Text className="mt-2 text-sm">{notice.body[1]}</Text>
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
