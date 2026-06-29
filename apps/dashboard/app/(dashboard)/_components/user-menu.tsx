'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  toast,
} from '@sparx/ui';
import { LogOut, MessageSquarePlus, Settings, User as UserIcon } from 'lucide-react';
import { authClient } from '@sparx/auth/client';
import { useQuery } from '@sparx/query';
import { useFeedback } from './feedback/feedback-provider';
import { getFeedbackUnreadCountAction } from '../_shell/feedback-actions';

export interface UserMenuUser {
  id: string;
  email: string;
  name?: string | null;
}

// Compact account control. Lives at the far right of the top toolbar — just the
// avatar, sized to fit the 48px header. The dropdown carries profile, settings,
// and sign-out.
export function UserMenu({ user, displayName }: { user: UserMenuUser; displayName: string }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [signingOut, setSigningOut] = React.useState(false);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['feedback', 'unread-count'],
    queryFn: getFeedbackUnreadCountAction,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push('/sign-in');
      router.refresh();
    } catch {
      toast.error('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${displayName}`}
        className="flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none"
      >
        <Avatar size="sm" alt={displayName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuLabel>Signed in as {user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserIcon className="h-4 w-4" />
            Profile
            <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => feedback.openSend({ source: 'button' })}>
          <MessageSquarePlus className="h-4 w-4" />
          Send feedback
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => feedback.openHistory()}>
          <MessageSquarePlus className="h-4 w-4" />
          Your feedback
          {unreadCount > 0 && (
            <span
              className="ml-auto h-2 w-2 rounded-full bg-[var(--color-text-link)]"
              aria-hidden
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
