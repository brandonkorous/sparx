'use client';

// AccountMenu — the storefront's auth affordance for a site header.
//
// A composition of silica's `Button`, `Avatar` and `DropdownMenu` in the shape
// this one builder node needs (root CLAUDE.md RULE #1) — it introduces no new
// control, and every piece of it is a real silica component.
//
// PRESENTATIONAL: it takes a resolved session (`name` / `status`), the hrefs, and
// a sign-out callback. It never talks to the account API itself — the live wiring
// lives in wizeworks/apps/site (the customer session), bridged through the Builder runtime.
//
//   · signed out → a "Sign in" ghost button + a "Sign up" primary button.
//   · signed in  → an avatar + name trigger opening Account / Orders / Wishlist /
//                  Sign out. Orders and Wishlist appear only when linked.
//   · loading    → an avatar-sized placeholder, so the bar doesn't jump from
//                  "Sign in" to the user menu once the session resolves.
//
// CLIENT component: the dropdown is genuine interactive state, and the `render`
// prop composition below is only legal inside a client module.

import * as React from 'react';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cx,
} from '@wizeworks/silicaui-react';

export type AccountStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AccountMenuProps {
  /** Display name when signed in (falsy → treated as signed out). */
  name?: string | null;
  /** Session status. Defaults from `name` (present → authenticated). */
  status?: AccountStatus;
  signInHref?: string;
  signUpHref?: string;
  accountHref?: string;
  /** Optional dropdown links — shown only when set. */
  ordersHref?: string;
  wishlistHref?: string;
  signInLabel?: string;
  signUpLabel?: string;
  /** Invoked when the signed-in user picks "Sign out". */
  onSignOut?: () => void;
  className?: string;
}

/** Initials for the avatar fallback — at most two, from the first and last word. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function AccountMenu({
  name,
  status = name ? 'authenticated' : 'anonymous',
  signInHref = '/account',
  signUpHref = '/account?mode=register',
  accountHref = '/account',
  ordersHref,
  wishlistHref,
  signInLabel = 'Sign in',
  signUpLabel = 'Sign up',
  onSignOut,
  className,
}: AccountMenuProps): React.ReactElement {
  const root = cx('flex items-center gap-2', className);

  if (status === 'loading') {
    // Reserves the signed-in trigger's footprint so the bar doesn't reflow.
    return (
      <div className={root}>
        <span className="skeleton skeleton-circle size-8" aria-hidden />
      </div>
    );
  }

  if (status !== 'authenticated' || !name) {
    return (
      <div className={root}>
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render` */}
        <Button variant="ghost" size="sm" render={<a href={signInHref} />}>
          {signInLabel}
        </Button>
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render` */}
        <Button color="primary" size="sm" render={<a href={signUpHref} />}>
          {signUpLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className={root}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button type="button" className="flex items-center gap-2" aria-label="Account menu">
            <Avatar size="sm" alt={name}>
              {initialsOf(name)}
            </Avatar>
            <span className="font-medium">{name}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          {/* eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render` */}
          <DropdownMenuItem render={<a href={accountHref} />}>Account</DropdownMenuItem>
          {ordersHref ? (
            // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
            <DropdownMenuItem render={<a href={ordersHref} />}>Orders</DropdownMenuItem>
          ) : null}
          {wishlistHref ? (
            // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
            <DropdownMenuItem render={<a href={wishlistHref} />}>Wishlist</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSignOut?.()}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
AccountMenu.displayName = 'AccountMenu';
