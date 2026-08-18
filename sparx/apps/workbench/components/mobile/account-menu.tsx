'use client';

// You, on a phone: the account menu behind the initials.
//
// It carries what a one-column header has no room for as its own control —
// appearance, business details, feedback, the tour, sign out. Same settings,
// same store, same words as the desktop toolbar; only the trigger differs.

import { LogOut, Compass, MessageSquarePlus, Settings } from 'lucide-react';
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
import { signOut } from '@wizeworks/auth/client';
import { Wordmark } from '@sparx/brand/react';
import { clearToken } from '../../lib/api/token';
import { resetClient } from '../../lib/api/client';
import { launchTour } from '../../lib/tour/first-run-tour';
import { useWorkbench } from '../../lib/workbench/context';
import type { ThemeChoice } from '../../lib/theme';
import { AppearanceMenuItems } from '../appearance-menu';
import { useFeedback } from '../feedback/provider';

interface AccountMenuProps {
  userName: string;
  userEmail: string;
  themeChoice: ThemeChoice;
  onSetTheme: (choice: ThemeChoice) => void;
}

export function AccountMenu({ userName, userEmail, themeChoice, onSetTheme }: AccountMenuProps) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {/* Colourless on purpose: this is chrome, and a bare `.btn` resolves to
            base-content in both themes without naming a colour it does not
            mean. */}
        <Button variant="ghost" shape="circle" className="min-h-11 min-w-11" aria-label="You">
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
        {/* The same three choices the desktop toolbar offers, from the same
            component — a phone has no room for a second trigger, but it is the
            same setting stored in the same place, so it must not acquire a
            second vocabulary here. */}
        <AppearanceMenuItems choice={themeChoice} onSetTheme={onSetTheme} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            controller.open('platform.settings.general');
          }}
        >
          <Settings className="size-4" aria-hidden />
          Business details
        </DropdownMenuItem>
        {/* Feedback reaches the same inbox from a phone as from a desk — the
            account menu carries it here because a one-column header has no room
            for another icon, not because it matters less. */}
        <DropdownMenuItem
          onClick={() => {
            feedback.openList();
          }}
        >
          <MessageSquarePlus className="size-4" aria-hidden />
          Your feedback
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            launchTour();
          }}
        >
          <Compass className="size-4" aria-hidden />
          Take the tour
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Signing out was reachable from the desktop toolbar and from nowhere
            at all on a phone — the one column had no room for it and it was
            simply dropped. Same call, same order: revoke the session, then clear
            the token and the query cache, then leave. */}
        <DropdownMenuItem
          onClick={() => {
            void signOut().finally(() => {
              clearToken();
              resetClient();
              window.location.href = '/sign-in';
            });
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Wordmark className="h-4" />
          </DropdownMenuLabel>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return letters.toUpperCase() || '?';
}
