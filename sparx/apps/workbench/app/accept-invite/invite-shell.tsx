'use client';

// The invite page's chrome: the workbench auth shell with its one tab.
//
// A client component because the tab carries an icon COMPONENT. The page is a
// server component, and React will not hand a component (an object with a render
// method) from the server to a client one: it refused, and the page fell over
// with "The workbench hit a problem" for every person ever invited, so nobody
// could join a team (sparx persona issue 121). Here the icon never crosses.

import type { ReactNode } from 'react';
import { UserPlus } from 'lucide-react';
import { AuthShell } from '../../components/auth-shell';

export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <AuthShell
      tabs={[{ id: 'invite', label: 'Accept invitation', icon: UserPlus }]}
      activeTab="invite"
    >
      {children}
    </AuthShell>
  );
}
