'use client';

// The compact shell — same app, presented for one hand and one column.
//
// It carries the same responsibilities as the desktop shell (where you are,
// search, navigation, the person) — but on a phone they live in a floating bar
// within thumb reach rather than behind a ☰ in the top-left corner, which is the
// one pattern the evidence is most consistently against.
//
// What it deliberately does NOT carry is the desktop's arrangement chrome: no
// rail, no status strip, no tear-off. Those are not "hidden on mobile", they are
// absent, because the stack host reports that it cannot do them (see
// PaneHost.capabilities).
//
// The status bar goes because its four signals don't survive the trip: an
// always-visible strip costs ~7% of a phone's height to tell you that you are
// online. Unsaved work — the one signal that can lose data — is not dropped; it
// rides the Open sheet's close button, which is where the decision is made.
//
// ── THE SHELL OWNS THE HOST ─────────────────────────────────────────────────
//
// The stack used to mint its own StackPaneHost and pin the open panes in a strip
// under itself. The bar's Open tab is that strip, so whoever renders both has to
// own the host — it is created here and handed down.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { getSurface, titleFor } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import { StackPaneHost } from '../lib/workbench/stack-host';
import type { ThemeChoice } from '../lib/theme';
import { ChromeBoundary } from './chrome-boundary';
import { useCopyLink, usePaneLink } from './copy-pane-link';
import { MobileStack } from './mobile-stack';
import { BillingBanner } from './billing/billing-banner';
import { AccountMenu } from './mobile/account-menu';
import { ModulesSheet } from './mobile/modules-sheet';
import { NavBar, type NavTab } from './mobile/nav-bar';
import { OpenSheet } from './mobile/open-sheet';

interface MobileShellProps {
  userName: string;
  userEmail: string;
  themeChoice: ThemeChoice;
  siteKey: string | null;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  onSetTheme: (choice: ThemeChoice) => void;
  onOpenLauncher: () => void;
}

export function MobileShell({
  userName,
  userEmail,
  themeChoice,
  siteKey,
  navOpen,
  onNavOpenChange,
  onSetTheme,
  onOpenLauncher,
}: MobileShellProps) {
  const { controller } = useWorkbench();

  // Created here, not in the stack: the bar's Open tab switches panes, so the
  // component rendering both has to hold the host.
  const hostRef = useRef<StackPaneHost | null>(null);
  hostRef.current ??= new StackPaneHost();
  const host = hostRef.current;
  const stack = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getServerSnapshot);

  // `navOpen` stays the shell's one "a sheet is covering the work" flag, so the
  // Back button keeps working unchanged — it is which sheet that is new.
  const [tab, setTab] = useState<NavTab | null>(null);

  // SUBSCRIBED, not just read. Reading getActiveDescriptor() during render gets
  // the right answer once and then never updates, so the header kept naming
  // whichever pane happened to be active at mount while the switcher below it
  // moved on. The descriptor object is stable between emits, which is what
  // getSnapshot requires.
  const active = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );
  // Which module the focused pane belongs to. The bar's Open tab wears its hue —
  // the only place a phone can carry module color once the rail is gone.
  const activeModule = (active ? getSurface(active.surface)?.module : undefined) ?? 'platform';

  // The Back button walks the shell's own navigation by driving `navOpen` false
  // (lib/workbench/nav-history.tsx). Without this the sheet stayed on screen
  // with its history entry already popped.
  useEffect(() => {
    if (!navOpen) setTab(null);
  }, [navOpen]);

  const dismissSheet = () => {
    setTab(null);
    onNavOpenChange(false);
  };

  return (
    <div className="bg-base-200 flex h-dvh w-full flex-col overflow-hidden">
      {/* Crash-isolated from the stack below, for the same reason as desktop:
          the panes hold the unsaved work and the header must never cost them.
          See components/chrome-boundary.tsx. */}
      <ChromeBoundary
        region="toolbar"
        whatStopped="Sharing and your account menu have stopped working."
      >
        <header className="border-base-300 bg-base-100 flex h-14 shrink-0 items-center gap-1 border-b px-1">
          {/* The title is the pane you are looking at — on one column that IS
            your location, so it replaces the wordmark the desktop toolbar can
            afford to keep. The mark moves into the account menu. */}
          {/* titleFor(), not descriptor.title — the latter is only populated once
            a surface has renamed itself, so reading it directly showed "sparx"
            for every pane that never called setTitle. */}
          <p className="ms-2 min-w-0 flex-1 truncate font-medium">
            {active ? titleFor(active) : 'sparx'}
          </p>

          {/* Sharing what you are looking at, from a phone, where sharing is what
            a phone is FOR. It uses the system share sheet when the browser has
            one — that is the gesture people already know, and it reaches the
            chat app they were going to paste into anyway — and falls back to the
            clipboard. Absent when the pane has no address; see
            components/copy-pane-link.tsx. */}
          <SharePaneButton paneId={active?.id ?? null} />

          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            themeChoice={themeChoice}
            onSetTheme={onSetTheme}
          />
        </header>
      </ChromeBoundary>

      {/* Billing lifecycle banner (docs/17 §6) — same escalation as desktop, in the
          one column beneath the header. */}
      <ChromeBoundary
        region="billing-banner"
        whatStopped="Notices about your plan and payments have stopped showing."
      >
        <BillingBanner />
      </ChromeBoundary>

      {/* `relative`: the bar floats against THIS box, over the stack and over any
          sheet, so navigation is never the thing you have to dismiss something
          else to reach. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Same gate as the dock: the stack must not restore Site A's panes and
            then discover we are on Site B. */}
        {siteKey ? <MobileStack siteKey={siteKey} host={host} /> : <div className="flex-1" />}

        {/* Silent: a sheet is shut almost always, so a visible fallback would be
            a permanent warning strip for a thing that is not on screen. */}
        <ChromeBoundary region="mobile-nav" whatStopped="The menu has stopped working." silent>
          <OpenSheet
            open={tab === 'open'}
            host={host}
            order={stack.order}
            activeId={stack.activeId}
            onDismiss={dismissSheet}
          />
          <ModulesSheet open={tab === 'all'} onDismiss={dismissSheet} />
        </ChromeBoundary>

        <ChromeBoundary
          region="nav-bar"
          whatStopped="The menu along the bottom has stopped working."
        >
          <NavBar
            active={tab}
            openCount={stack.order.length}
            activeModule={activeModule}
            onSelect={(next) => {
              // Home and Search are ACTIONS, not sheets — they open something
              // and leave the work uncovered.
              if (next === 'home') {
                controller.open('workbench.home');
                setTab(null);
                onNavOpenChange(false);
                return;
              }
              if (next === 'search') {
                onOpenLauncher();
                return;
              }
              // Tapping the sheet you are already in closes it.
              const to = tab === next ? null : next;
              setTab(to);
              onNavOpenChange(to !== null);
            }}
          />
        </ChromeBoundary>
      </div>
    </div>
  );
}

/**
 * Share (or copy) the address of the pane on screen.
 *
 * `navigator.share` where it exists, clipboard where it doesn't. The check is
 * held in state rather than read during render because it differs between server
 * and client, and reading it inline is a hydration mismatch — the button would
 * render one glyph on the server and another the instant React took over.
 */
function SharePaneButton({ paneId }: { paneId: string | null }) {
  const link = usePaneLink(paneId);
  const copyLink = useCopyLink();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  if (!link) return null;

  return (
    <Button
      variant="ghost"
      shape="square"
      className="min-h-11 min-w-11"
      aria-label="Share a link to this panel"
      onClick={() => {
        if (canShare) {
          // A cancelled share sheet rejects, which is not an error — it is
          // somebody changing their mind. Swallowed rather than surfaced.
          void navigator.share({ url: link }).catch(() => undefined);
          return;
        }
        void copyLink(link);
      }}
    >
      <Share2 className="size-5" aria-hidden />
    </Button>
  );
}
