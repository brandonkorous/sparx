'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarAppShell, Text } from '@sparx/ui';
import type { OperatorCapability } from '@sparx/operator';
import { ConsoleRail } from './console-rail';
import { ConsoleMobileNav } from './console-mobile-nav';
import { SignOutButton } from './sign-out-button';

// The operator console's authenticated shell (docs/apps/admin/build-plan.md) —
// the shared SidebarAppShell (@sparx/ui) with an operator rail + mobile drawer,
// the same chassis the tenant dashboard uses. The console has no contextual
// second column, so `panel` is null (the shell drops the gutter). Operator
// identity + sign-out live in the top header (like the dashboard's user menu),
// not the rail.

export function ConsoleShell({
  email,
  capabilities,
  children,
}: {
  email: string;
  capabilities: OperatorCapability[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <SidebarAppShell
      pathname={pathname}
      mobileNavLabel="Operator console"
      rail={<ConsoleRail pathname={pathname} capabilities={capabilities} />}
      panel={null}
      mobileNav={<ConsoleMobileNav pathname={pathname} capabilities={capabilities} />}
      headerStart={
        <Text size="sm" variant="muted">
          Operator Console
        </Text>
      }
      headerActions={
        <>
          <Text size="sm" variant="muted" className="hidden sm:block">
            {email}
          </Text>
          <SignOutButton />
        </>
      }
    >
      <div className="mx-auto max-w-6xl p-6">{children}</div>
    </SidebarAppShell>
  );
}
