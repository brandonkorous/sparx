'use client';

// Who you are, and the three ways out: your plan, your cookie choice, and the
// door. Split out of topbar.tsx (RULE #0.5).

import { useRef } from 'react';
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
import {
  faChevronDown,
  faCookie,
  faCreditCard,
  faRightFromBracket,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useViewer } from '@/lib/api/shell-data';

/**
 * The person's role, in words a business owner uses. The platform's roles are
 * `owner` / `admin` / `editor` / `viewer`; nobody calls themselves an editor of
 * their own shop.
 *
 * Null when nothing is known yet. The default branch answered "Team member" for
 * an unloaded viewer, so every reload told the OWNER of the business she was
 * staff until the request came back (issue 144).
 */
function roleLabel(role: string | undefined): string | null {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Runs the place';
    case 'editor':
      return 'Team member';
    case 'viewer':
      return 'Can look, not touch';
    default:
      return null;
  }
}

/** Two-letter fallback for the avatar chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
}

export function ViewerMenu({
  userName,
  userEmail,
  accountOrigin,
}: {
  userName: string;
  userEmail: string;
  accountOrigin: string;
}) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const { data: viewer } = useViewer();
  const role = roleLabel(viewer?.role);

  return (
    <>
      <DropdownMenu>
        <Tooltip content={userName}>
          <DropdownMenuTrigger>
            {/* Name and role beside the avatar, as the mockup has it. Not
                vanity: this console can act as several BUSINESSES and the role
                differs per business, so "who am I being right now" is a real
                question. Hidden below `md`, where the bar has no room. */}
            <Button variant="ghost" className="gap-2 pr-2 pl-1" aria-label={`You — ${userName}`}>
              <Avatar size="md" alt={userName}>
                {initials(userName)}
              </Avatar>
              <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
                <span className="max-w-32 truncate text-sm font-semibold">{userName}</span>
                {/* Reserved whether or not it is known, so the name does not
                    shift down the moment the answer arrives. */}
                <span className="min-h-4 max-w-32 truncate text-xs">{role ?? ''}</span>
              </span>
              <Icon glyph={faChevronDown} className="size-3 shrink-0" aria-hidden />
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
          {/* Off to the account app, because that is where the subscription
              lives. The console never shows a price and never takes a payment
              (piggles/CLAUDE.md RULE #2). */}
          <DropdownMenuItem
            onClick={() => {
              window.location.href = `${accountOrigin}/account`;
            }}
          >
            <Icon glyph={faCreditCard} className="size-4" aria-hidden />
            Your plan and billing
          </DropdownMenuItem>
          {/* The way back to the consent decision — a LINK OUT, like billing
              above it. The answer lives on the account, not on this domain, so
              the screen that can change it is the screen that asked for it. */}
          <DropdownMenuItem
            onClick={() => {
              window.location.href = `${accountOrigin}/cookie-choices`;
            }}
          >
            <Icon glyph={faCookie} className="size-4" aria-hidden />
            Cookie choices
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Submits the form below rather than navigating. Signing out
              // changes state on the server, so it has to be a POST: a GET that
              // does that is one pixel-tracker away from being triggered by any
              // page the person happens to visit.
              signOutForm.current?.requestSubmit();
            }}
          >
            <Icon glyph={faRightFromBracket} className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Outside the menu, because the menu's content is portalled and unmounts
          the moment an item is clicked — a form living inside it would be gone
          before it could be submitted. */}
      <form ref={signOutForm} action="/sign-out" method="post" className="hidden" />
    </>
  );
}
