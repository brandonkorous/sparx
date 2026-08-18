'use client';

// You, on a phone: the account menu behind the avatar.
//
// It carries what a one-column header has no room for as its own control —
// appearance, business details, feedback, billing, sign out. Same settings, same
// store, same words as the desktop bar; only the trigger differs.

import { useRef } from 'react';
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
import { Logo } from '@piggles/brand/react';
import { PRODUCT } from '@piggles/config';
import { useWorkbench } from '@/lib/workbench/context';
import { useFeedback } from '@/components/feedback/provider';
import { AppearanceMenuItems } from '@/components/appearance-menu';
import type { Theme, ThemeChoice } from '@/lib/theme';

interface AccountMenuProps {
  userName: string;
  userEmail: string;
  themeChoice: ThemeChoice;
  theme: Theme;
  accountOrigin: string;
  onSetTheme: (choice: ThemeChoice) => void;
}

export function AccountMenu({
  userName,
  userEmail,
  themeChoice,
  theme,
  accountOrigin,
  onSetTheme,
}: AccountMenuProps) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
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
          {/* The same three choices the desktop bar offers, from the same
              component — a phone has no room for a second trigger, but it is
              the same setting stored in the same place, so it must not
              acquire a second vocabulary here. */}
          <AppearanceMenuItems choice={themeChoice} theme={theme} onSetTheme={onSetTheme} />
          <DropdownMenuSeparator />
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

      {/* Outside the menu, whose content is portalled and unmounts the moment an
          item is clicked. */}
      <form ref={signOutForm} action="/sign-out" method="post" className="hidden" />
    </>
  );
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return letters.toUpperCase() || '?';
}
