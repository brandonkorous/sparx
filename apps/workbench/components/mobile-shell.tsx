'use client';

// The compact shell — same app, presented for one hand and one column.
//
// It carries the same responsibilities as the desktop shell (identity, search,
// navigation, the person) in a bar the height of a thumb. What it deliberately
// does NOT carry is the desktop's arrangement chrome: no rail, no status strip,
// no tear-off. Those are not "hidden on mobile", they are absent, because the
// stack host reports that it cannot do them (see PaneHost.capabilities).
//
// The status bar goes because its four signals don't survive the trip: an
// always-visible strip costs ~7% of a phone's height to tell you that you are
// online. Unsaved work — the one signal that can lose data — is not dropped; it
// rides the pane switcher's close button, which is where the decision is made.

import { useSyncExternalStore } from 'react';
import { Menu, Search } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/brand/react';
import { titleFor } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import type { Theme } from '../lib/theme';
import { useFeedback } from './feedback/provider';
import { MobileStack } from './mobile-stack';
import { MobileNav } from './mobile-nav';
import { BillingBanner } from './billing/billing-banner';

interface MobileShellProps {
  userName: string;
  userEmail: string;
  theme: Theme;
  siteKey: string | null;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  onToggleTheme: () => void;
  onOpenLauncher: () => void;
}

export function MobileShell({
  userName,
  userEmail,
  theme,
  siteKey,
  navOpen,
  onNavOpenChange,
  onToggleTheme,
  onOpenLauncher,
}: MobileShellProps) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
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

  return (
    <div className="bg-base-200 flex h-dvh w-full flex-col overflow-hidden">
      <header className="border-base-300 bg-base-100 flex h-14 shrink-0 items-center gap-1 border-b px-1">
        <Button
          color="neutral"
          variant="ghost"
          shape="square"
          className="min-h-11 min-w-11"
          aria-label="Open navigation"
          onClick={() => {
            onNavOpenChange(true);
          }}
        >
          <Menu className="size-5" aria-hidden />
        </Button>

        {/* The title is the pane you are looking at — on one column that IS
            your location, so it replaces the wordmark the desktop toolbar can
            afford to keep. The mark moves into the account menu. */}
        {/* titleFor(), not descriptor.title — the latter is only populated once
            a surface has renamed itself, so reading it directly showed "sparx"
            for every pane that never called setTitle. */}
        <p className="min-w-0 flex-1 truncate font-medium">{active ? titleFor(active) : 'sparx'}</p>

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
              aria-label="Your account"
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
                no room for another icon, not because it matters less. It opens
                the same surface, which on one column is simply the top of the
                stack. */}
            <DropdownMenuItem
              onClick={() => {
                feedback.openList();
              }}
            >
              Your feedback
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <Wordmark className="h-4" />
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Billing lifecycle banner (docs/17 §6) — same escalation as desktop, in the
          one column beneath the header. */}
      <BillingBanner />

      {/* Same gate as the dock: the stack must not restore Site A's panes and
          then discover we are on Site B. */}
      {siteKey ? <MobileStack siteKey={siteKey} /> : <div className="flex-1" />}

      <MobileNav open={navOpen} onOpenChange={onNavOpenChange} />
    </div>
  );
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return letters.toUpperCase() || '?';
}
