'use client';

// The compact shell — the same product, presented for one hand and one column.
//
// It carries the same responsibilities as the desktop shell (where you are,
// search, navigation, you) — but on a phone they live in a floating bar within
// thumb reach rather than behind a ☰ in the top-left corner, which is the one
// pattern the evidence is most consistently against.
//
// What it deliberately does NOT carry is the desktop's arrangement chrome: no
// rail, no status strip, no tear-off. Those are not "hidden on mobile", they are
// absent, because the stack host reports that it cannot do them.
//
// ── THE SHELL OWNS THE HOST ─────────────────────────────────────────────────
//
// The stack used to mint its own StackPaneHost and pin the open panes in a strip
// under itself. The bar's Open tab is that strip, so whoever renders both has to
// own the host — it is created here and handed down.
//
// This is a full presentation, not a fallback. A business owner doing the books
// on a phone in a stockroom is the normal case for this product, not the edge.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { faShareNodes } from '@fortawesome/pro-solid-svg-icons';
import { HeaderNotice, type HeaderNoticeData, Icon } from '@piggles/ui';
import { LifecycleBand } from '@/components/lifecycle-band';
import { Button } from '@wizeworks/silicaui-react';
import { Logo } from '@piggles/brand/react';
import { MODULE_TO_APP, PRODUCT } from '@piggles/config';
import { titleFor } from '@/lib/surfaces/registry';
import { useWorkbench } from '@/lib/workbench/context';
import { ChromeBoundary } from '@/components/chrome-boundary';
import { useCopyLink, usePaneLink } from '@/components/copy-pane-link';
import { MobileStack } from '@/components/mobile-stack';
import type { Theme, ThemeChoice } from '@/lib/theme';
import type { ConsoleNavApp } from '@/lib/console/nav';
import { StackPaneHost } from '@/lib/workbench/stack-host';
import { getSurface } from '@/lib/surfaces/registry';
import { AccountMenu } from './mobile/account-menu';
import { AppsSheet } from './mobile/apps-sheet';
import { NavBar, type NavTab } from './mobile/nav-bar';
import { OpenSheet } from './mobile/open-sheet';

interface CompactConsoleProps {
  /** What WizeWorks is announcing on this surface, or null. */
  notice: HeaderNoticeData | null;
  nav: ConsoleNavApp[];
  userName: string;
  userEmail: string;
  themeChoice: ThemeChoice;
  theme: Theme;
  siteKey: string | null;
  accountOrigin: string;
  navTab: NavTab | null;
  /** The launcher is Search's destination, so the bar reads it to light that tab. */
  launcherOpen: boolean;
  onNavTabChange: (tab: NavTab | null) => void;
  onSetTheme: (choice: ThemeChoice) => void;
  onOpenLauncher: () => void;
}

export function CompactConsole({
  notice,
  nav,
  userName,
  userEmail,
  themeChoice,
  theme,
  siteKey,
  accountOrigin,
  navTab,
  launcherOpen,
  onNavTabChange,
  onSetTheme,
  onOpenLauncher,
}: CompactConsoleProps) {
  const { controller } = useWorkbench();

  // Created here, not in the stack: the bar's Open tab switches panes, so the
  // component rendering both has to hold the host.
  const hostRef = useRef<StackPaneHost | null>(null);
  hostRef.current ??= new StackPaneHost();
  const host = hostRef.current;
  const stack = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getServerSnapshot);

  /** Shut whichever sheet is up. Stable identity so the sheets do not re-render
   *  on every keystroke elsewhere in the shell. */
  const dismiss = useCallback(() => {
    onNavTabChange(null);
  }, [onNavTabChange]);

  // SUBSCRIBED, not just read. Reading `getActiveDescriptor()` during render
  // gets the right answer once and then never updates, so the header would keep
  // naming whichever panel happened to be active at mount while the switcher
  // below it moved on.
  const active = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );
  // Which app the focused pane belongs to. The bar's Open tab wears its hue —
  // the only place a phone can carry module color once the rail is gone.
  const activeSurface = active ? getSurface(active.surface) : undefined;
  const activeApp = activeSurface ? (MODULE_TO_APP[activeSurface.module] ?? 'home') : 'home';

  // What the bar marks as current. `navTab` alone only ever knew about the two
  // SHEETS, so Home and Search — which open a pane and an overlay instead —
  // could be the thing you were looking at while the bar showed nothing
  // selected. Each tab is read from whatever it actually opened.
  //
  // Ordered by what is in front: a sheet covers the launcher covers the stack.
  const barTab: NavTab | null =
    navTab ?? (launcherOpen ? 'search' : active?.surface === 'piggles.home' ? 'home' : null);

  return (
    <div className="bg-base-200 flex h-dvh w-full flex-col overflow-hidden">
      {/* ABOVE the header, inside the h-dvh column, so the bar takes its height
          off the stack instead of pushing the thumb bar off screen. Renders
          nothing when there is nothing to say. */}
      <HeaderNotice notice={notice} />

      {/* `railCardVisible={false}` is the literal truth on a phone: there is no
          rail, so nothing else in this shell says the account is counting down.
          Before this, a phone showed NOTHING about a trial ending and then the
          site went dark. */}
      <LifecycleBand accountOrigin={accountOrigin} railCardVisible={false} />

      {/* Crash-isolated from the stack below, for the same reason as desktop:
          the panels hold the unsaved work and the header must never cost them. */}
      <ChromeBoundary
        region="topbar"
        whatStopped="Search and your account menu have stopped working."
      >
        <header className="border-base-300 bg-base-100 flex h-14 shrink-0 items-center gap-1 border-b px-1">
          {/* The title is what you are looking at — on one column that IS your
              location, so it replaces the lockup the desktop bar can afford to
              keep. The mark moves into the account menu.

              `titleFor()`, not `descriptor.title`: the latter is only populated
              once a screen has renamed itself, so reading it directly showed the
              product name for every panel that never called setTitle. */}
          <Logo className="ms-2 h-8 w-auto shrink-0" title={PRODUCT.name} />
          <p className="min-w-0 flex-1 truncate font-medium">
            {active ? titleFor(active) : PRODUCT.name}
          </p>

          {/* Sharing what you are looking at, from a phone, where sharing is what
              a phone is FOR. It uses the system share sheet when the browser has
              one — the gesture people already know, reaching the chat app they
              were going to paste into anyway — and falls back to the clipboard. */}
          <SharePanelButton paneId={active?.id ?? null} />

          <AccountMenu
            userName={userName}
            userEmail={userEmail}
            themeChoice={themeChoice}
            theme={theme}
            accountOrigin={accountOrigin}
            onSetTheme={onSetTheme}
          />
        </header>
      </ChromeBoundary>

      {/* `relative`: the bar floats against THIS box, over the stack and over
          any sheet, so navigation is never the thing you have to dismiss
          something else to reach. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Same gate as the dock: the stack must not restore Site A's panels and
            then discover we are on Site B. */}
        {siteKey ? <MobileStack siteKey={siteKey} host={host} /> : <div className="flex-1" />}

        {/* Silent: a sheet is shut almost always, so a visible fallback would be
            a permanent warning strip for a thing that is not on screen. */}
        <ChromeBoundary region="app-drawer" whatStopped="The menu has stopped working." silent>
          <OpenSheet
            open={navTab === 'open'}
            host={host}
            order={stack.order}
            activeId={stack.activeId}
            onDismiss={dismiss}
          />
          <AppsSheet open={navTab === 'all'} nav={nav} onDismiss={dismiss} />
        </ChromeBoundary>

        <ChromeBoundary
          region="nav-bar"
          whatStopped="The menu along the bottom has stopped working."
        >
          <NavBar
            active={barTab}
            openCount={stack.order.length}
            activeApp={activeApp}
            onSelect={(next) => {
              // Home and Search are ACTIONS, not sheets — they open something
              // and leave the work uncovered.
              if (next === 'home') {
                controller.open('piggles.home');
                dismiss();
                return;
              }
              if (next === 'search') {
                onOpenLauncher();
                return;
              }
              // Tapping the sheet you are already in closes it.
              onNavTabChange(navTab === next ? null : next);
            }}
          />
        </ChromeBoundary>
      </div>
    </div>
  );
}

/**
 * Share (or copy) the address of the panel on screen.
 *
 * `navigator.share` where it exists, clipboard where it does not. The check is
 * held in state rather than read during render because it differs between server
 * and client, and reading it inline is a hydration mismatch — the button would
 * render one glyph on the server and another the instant React took over.
 */
function SharePanelButton({ paneId }: { paneId: string | null }) {
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
      aria-label="Share a link to this"
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
      <Icon glyph={faShareNodes} className="size-5" aria-hidden />
    </Button>
  );
}
