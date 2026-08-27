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
import { surfaceTitle } from '@/lib/surfaces/registry';
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
  const securityLabel = surfaceTitle('platform.settings.security');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" shape="circle" className="min-h-11 min-w-11" aria-label="You">
            {initials(userName, userEmail)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* A plain block, NOT DropdownMenuLabel. That component is silica's
              group HEADING — uppercase, 12px, 55% opacity — which is right for
              "Your sites" and wrong for a person's own address: it rendered
              hers as P03.DEVI@PIGGLES.TEST, faded, in the one place she looks
              to check which account she is signed in to. Silica has no
              non-heading header slot for a menu; when it does, this becomes
              that component. */}
          <div className="flex flex-col px-2.5 py-1.5">
            <span className="truncate font-medium">{userName}</span>
            <span className="truncate text-sm">{userEmail}</span>
          </div>
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
            {surfaceTitle('platform.settings.general') ?? 'Business details'}
          </DropdownMenuItem>
          {/* The same door to her password, devices and two-step verification
              the desktop bar now carries. A phone is where a person is most
              likely to be told to turn two-step on. */}
          {securityLabel !== null ? (
            <DropdownMenuItem
              onClick={() => {
                controller.open('platform.settings.security');
              }}
            >
              {securityLabel}
            </DropdownMenuItem>
          ) : null}
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
