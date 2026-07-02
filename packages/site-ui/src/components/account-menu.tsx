'use client';

// AccountMenu — the storefront auth affordance for a navbar (docs/27, docs/57
// rebuild). PRESENTATIONAL: it takes a resolved session (`name`/`status`) + hrefs
// + a sign-out callback, and never talks to the account API itself — the live
// wiring lives in apps/site (the customer session), bridged through the Builder
// runtime, so this component stays a pure @sparx/site-ui primitive.
//
//   · signed out  → a "Sign in" ghost button + a "Sign up" primary button.
//   · signed in   → an avatar + name trigger opening a dropdown (Account / Orders /
//                   Wishlist / Sign out). Orders + Wishlist show only when linked.
//   · loading     → a neutral avatar-sized placeholder, so the bar doesn't jump
//                   from "Sign in" to the user menu once the session resolves.
//
// Composition: COMPOSITE (docs/23 §17) — assembles Button + Avatar + DropdownMenu.

import * as React from 'react';
import { cx } from '../utils/cx';
import { Button } from './button';
import { Avatar } from './avatar';
import { DropdownMenu } from './dropdown-menu';

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
  if (status === 'loading') {
    return (
      <div className={cx('st-account', className)}>
        <span className="st-account__skeleton" aria-hidden />
      </div>
    );
  }

  if (status !== 'authenticated' || !name) {
    return (
      <div className={cx('st-account', className)}>
        <Button href={signInHref} color="neutral" variant="ghost" size="sm">
          {signInLabel}
        </Button>
        <Button href={signUpHref} color="primary" variant="solid" size="sm">
          {signUpLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className={cx('st-account', className)}>
      <DropdownMenu>
        <DropdownMenu.Trigger className="st-account__trigger" aria-label="Account menu">
          <Avatar name={name} size="sm" />
          <span className="st-account__name">{name}</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Label>{name}</DropdownMenu.Label>
          <DropdownMenu.Item asChild>
            <a href={accountHref}>Account</a>
          </DropdownMenu.Item>
          {ordersHref ? (
            <DropdownMenu.Item asChild>
              <a href={ordersHref}>Orders</a>
            </DropdownMenu.Item>
          ) : null}
          {wishlistHref ? (
            <DropdownMenu.Item asChild>
              <a href={wishlistHref}>Wishlist</a>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => onSignOut?.()}>Sign out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
AccountMenu.displayName = 'AccountMenu';
