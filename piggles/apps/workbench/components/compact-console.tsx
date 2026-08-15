'use client';

// The compact shell — the same product, presented for one hand and one column.
//
// It carries the same responsibilities as the desktop shell (where you are,
// search, navigation, you) in a bar the height of a thumb. What it deliberately
// does NOT carry is the desktop's arrangement chrome: no rail, no status strip,
// no tear-off. Those are not "hidden on mobile", they are absent, because the
// stack host reports that it cannot do them.
//
// The status strip goes because its signals do not survive the trip: an
// always-visible strip costs about 7% of a phone's height to say that you are
// online. Unsaved work — the one signal that can lose data — is not dropped; it
// rides the panel switcher's close button, which is where the decision is made.
//
// This is a full presentation, not a fallback. A business owner doing the books
// on a phone in a stockroom is the normal case for this product, not the edge.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Grid2x2Plus, Menu, Search, Share2 } from 'lucide-react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarItem,
} from '@wizeworks/silicaui-react';
import { Logo } from '@piggles/brand/react';
import { PRODUCT } from '@piggles/config';
import { titleFor } from '@/lib/surfaces/registry';
import { useWorkbench } from '@/lib/workbench/context';
import { ChromeBoundary } from '@/components/chrome-boundary';
import { useCopyLink, usePaneLink } from '@/components/copy-pane-link';
import { useFeedback } from '@/components/feedback/provider';
import { MobileStack } from '@/components/mobile-stack';
import type { Theme } from '@/lib/theme';
import type { ConsoleNavApp } from '@/lib/console/nav';
import { AllAppsDialog } from './all-apps-dialog';
import { AppPanel } from './app-panel';
import { AppScope } from './app-scope';

interface CompactConsoleProps {
  nav: ConsoleNavApp[];
  userName: string;
  userEmail: string;
  theme: Theme;
  siteKey: string | null;
  accountOrigin: string;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  onToggleTheme: () => void;
  onOpenLauncher: () => void;
}

export function CompactConsole({
  nav,
  userName,
  userEmail,
  theme,
  siteKey,
  accountOrigin,
  navOpen,
  onNavOpenChange,
  onToggleTheme,
  onOpenLauncher,
}: CompactConsoleProps) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const signOutForm = useRef<HTMLFormElement>(null);

  // SUBSCRIBED, not just read. Reading `getActiveDescriptor()` during render
  // gets the right answer once and then never updates, so the header would keep
  // naming whichever panel happened to be active at mount while the switcher
  // below it moved on.
  const active = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );

  return (
    <div className="bg-base-200 flex h-dvh w-full flex-col overflow-hidden">
      {/* Crash-isolated from the stack below, for the same reason as desktop:
          the panels hold the unsaved work and the header must never cost them. */}
      <ChromeBoundary
        region="topbar"
        whatStopped="Search and your account menu have stopped working."
      >
        <header className="border-base-300 bg-base-100 flex h-14 shrink-0 items-center gap-1 border-b px-1">
          <Button
            color="neutral"
            variant="ghost"
            shape="square"
            className="min-h-11 min-w-11"
            aria-label="Open the menu"
            onClick={() => {
              onNavOpenChange(true);
            }}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          {/* The title is what you are looking at — on one column that IS your
              location, so it replaces the lockup the desktop bar can afford to
              keep. The mark moves into the account menu.

              `titleFor()`, not `descriptor.title`: the latter is only populated
              once a screen has renamed itself, so reading it directly showed the
              product name for every panel that never called setTitle. */}
          <p className="min-w-0 flex-1 truncate font-medium">
            {active ? titleFor(active) : PRODUCT.name}
          </p>

          {/* Sharing what you are looking at, from a phone, where sharing is what
              a phone is FOR. It uses the system share sheet when the browser has
              one — the gesture people already know, reaching the chat app they
              were going to paste into anyway — and falls back to the clipboard. */}
          <SharePanelButton paneId={active?.id ?? null} />

          <Button
            color="neutral"
            variant="ghost"
            shape="square"
            className="min-h-11 min-w-11"
            aria-label="Search everything"
            onClick={onOpenLauncher}
          >
            <Search className="size-5" aria-hidden />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                color="neutral"
                variant="ghost"
                shape="circle"
                className="min-h-11 min-w-11"
                aria-label="You"
              >
                {initials(userName, userEmail)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block truncate">{userName}</span>
                  <span className="block truncate text-sm">{userEmail}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleTheme}>
                {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  controller.open('platform.settings.general');
                }}
              >
                Business details
              </DropdownMenuItem>
              {/* Feedback reaches the same inbox from a phone as from a desk —
                  the account menu carries it here because a one-column header has
                  no room for another icon, not because it matters less. */}
              <DropdownMenuItem
                onClick={() => {
                  feedback.openList();
                }}
              >
                Your feedback
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = `${accountOrigin}/account`;
                }}
              >
                Your plan and billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  // POST, for the same reason as on desktop: signing out revokes
                  // the session row and clears this domain's cookie, and a GET
                  // that does that can be triggered by any page the person
                  // happens to visit.
                  signOutForm.current?.requestSubmit();
                }}
              >
                Sign out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <Logo className="h-4 w-auto" title={PRODUCT.name} />
                </DropdownMenuLabel>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Outside the menu, whose content is portalled and unmounts the moment
              an item is clicked. */}
          <form ref={signOutForm} action="/sign-out" method="post" className="hidden" />
        </header>
      </ChromeBoundary>

      {/* Same gate as the dock: the stack must not restore Site A's panels and
          then discover we are on Site B. */}
      {siteKey ? <MobileStack siteKey={siteKey} /> : <div className="flex-1" />}

      {/* Silent: the drawer is closed almost always, so a visible fallback would
          be a permanent warning strip for a thing that is not on screen. */}
      <ChromeBoundary region="app-drawer" whatStopped="The menu has stopped working." silent>
        <AppDrawer nav={nav} open={navOpen} onOpenChange={onNavOpenChange} />
      </ChromeBoundary>
    </div>
  );
}

/**
 * Navigation as a drawer, in two levels.
 *
 * The desktop rail and app panel are two columns you read at once. On a phone
 * there is only ever one column, so the same information becomes a drill-down:
 * apps, then that app's screens, with a way back.
 *
 * The second level REUSES <AppPanel> rather than reimplementing it. That keeps
 * one answer to "what is in Sell" — including its filter, its section headings
 * and its quick-create — and means a screen added to the platform appears on
 * both presentations with no second edit.
 */
function AppDrawer({
  nav,
  open,
  onOpenChange,
}: {
  nav: ConsoleNavApp[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // null = the app list; an id = that app's screens.
  const [appId, setAppId] = useState<string | null>(null);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const entry =
    appId === null ? null : (nav.find((candidate) => candidate.app.id === appId) ?? null);

  const close = () => {
    onOpenChange(false);
    // Reset to the app list only AFTER the drawer is shut, so the panel does not
    // visibly snap back to level one while sliding away.
    setTimeout(() => {
      setAppId(null);
    }, 200);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      {/* w-[85vw] leaves a strip of the app visible, so the drawer reads as
          covering the screen rather than being a new one. */}
      <DrawerContent side="left" className="w-[85vw] max-w-sm p-0">
        {entry ? (
          <>
            <DrawerHeader sticky className="gap-2">
              <Button
                color="neutral"
                variant="ghost"
                size="sm"
                className="min-h-11 gap-1"
                onClick={() => {
                  setAppId(null);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
                All apps
              </Button>
            </DrawerHeader>
            {/* Never pinned: on a phone the panel IS the drawer, and opening
                something has to dismiss it or the screen stays covered. */}
            <AppPanel
              entry={entry}
              pinned={false}
              pinnable={false}
              // The drawer decides the width here, not the panel — see the prop.
              width="fill"
              onTogglePin={() => undefined}
              onDismiss={close}
            />
          </>
        ) : (
          <>
            <DrawerHeader sticky>
              <DrawerTitle>Everything {PRODUCT.name} does</DrawerTitle>
            </DrawerHeader>
            {/* Fills the drawer. Left at silica's own 16rem it was a 256px list
                inside a 328px drawer, with 72px of nothing down the right-hand
                side — and every row's tap target 72px narrower than the sheet
                it appears to be part of. */}
            <Sidebar
              collapsed={false}
              color="module"
              aria-label="Apps"
              className="h-full w-full [--sidebar-w:100%]"
            >
              <SidebarContent>
                <SidebarGroup>
                  {nav.map((candidate) => (
                    <AppScope key={candidate.app.id} app={candidate.app.id}>
                      <SidebarItem
                        // min-h-11 (44px) is the thumb-target floor. The rail's
                        // desktop density is a mouse affordance and would be a
                        // mis-tap generator here.
                        className="min-h-11"
                        icon={<candidate.icon className="text-module size-5" aria-hidden />}
                        trailing={<ChevronRight className="size-4" aria-hidden />}
                        onClick={() => {
                          setAppId(candidate.app.id);
                        }}
                      >
                        {candidate.label}
                      </SidebarItem>
                    </AppScope>
                  ))}
                </SidebarGroup>
                {/* The same permanent door as the desktop rail's footer, for the
                    same reason: an app that is not switched on has to stay
                    visible, or onboarding's question becomes a paywall. */}
                <SidebarGroup>
                  <SidebarItem
                    className="min-h-11"
                    icon={<Grid2x2Plus className="size-5" aria-hidden />}
                    onClick={() => {
                      setAllAppsOpen(true);
                    }}
                  >
                    All apps
                  </SidebarItem>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </>
        )}
      </DrawerContent>
      <AllAppsDialog open={allAppsOpen} onOpenChange={setAllAppsOpen} />
    </Drawer>
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
      color="neutral"
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
      <Share2 className="size-5" aria-hidden />
    </Button>
  );
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return letters.toUpperCase() || '?';
}
