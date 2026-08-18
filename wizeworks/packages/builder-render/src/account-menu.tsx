'use client';

// The AccountMenu render island (docs/27, docs/57 rebuild). Reads the live customer
// session from the Builder runtime and renders the presentational
// AccountMenu. On the live storefront the runtime supplies the real session
// (bridged from wizeworks/apps/site's CustomerProvider); on the editor canvas there is none,
// so we PREVIEW the signed-in state — the author gets to see and open the account
// dropdown they're configuring instead of only the signed-out buttons.

import * as React from 'react';
import { AccountMenu } from './atoms';
import { useBuilderRuntime, useEditMode } from './runtime-context';

export interface BuilderAccountMenuProps {
  signInHref?: string;
  signUpHref?: string;
  accountHref?: string;
  ordersHref?: string;
  wishlistHref?: string;
  signInLabel?: string;
  signUpLabel?: string;
  className?: string;
}

export function BuilderAccountMenu(props: BuilderAccountMenuProps): React.ReactElement {
  const { account } = useBuilderRuntime();
  const edit = useEditMode();
  // Canvas preview: no session, so show the signed-in menu with a sample name (the
  // richer state the author is composing). Live reads the resolved session.
  const status = edit ? 'authenticated' : (account?.status ?? 'anonymous');
  const name = edit ? 'Your account' : (account?.name ?? null);
  return (
    <AccountMenu
      {...props}
      status={status}
      name={name}
      onSignOut={edit ? undefined : account?.signOut}
    />
  );
}
BuilderAccountMenu.displayName = 'BuilderAccountMenu';
