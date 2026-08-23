'use client';

// Who you are, and the ways out. Split out of toolbar.tsx.
//
// The avatar chip, the person's name and address, their own feedback, the tour,
// and the door. Everything here is about the SESSION rather than about what is
// on screen, which is why it sits at the far end of the bar.

import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Compass, LogOut, MessageSquarePlus } from 'lucide-react';
import { signOut } from '@wizeworks/auth/client';
import { clearToken } from '../../lib/api/token';
import { resetClient } from '../../lib/api/client';
import { launchTour } from '../../lib/tour/first-run-tour';
import { useFeedback } from '../feedback/provider';

/** Two-letter fallback for the avatar chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
}

export function ViewerMenu({ userName, userEmail }: { userName: string; userEmail: string }) {
  const feedback = useFeedback();

  const onSignOut = () => {
    void signOut().finally(() => {
      clearToken();
      resetClient();
      window.location.href = '/sign-in';
    });
  };

  return (
    <DropdownMenu>
      <Tooltip content={userName}>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="sm" shape="square" aria-label={`Account — ${userName}`}>
            <Avatar size="xs" color="neutral" alt={userName}>
              {initials(userName)}
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="flex flex-col">
              <span className="font-medium">{userName}</span>
              <span className="text-sm font-normal">{userEmail}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
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
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
