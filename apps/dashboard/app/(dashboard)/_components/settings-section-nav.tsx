'use client';

import * as React from 'react';
import Link from 'next/link';
import { SidebarItem } from '@sparx/ui';
import { Settings as SettingsIcon } from 'lucide-react';
import { SETTINGS_NAV } from '../settings/nav';

// Settings' intra-section navigation: an "Overview" entry (the settings landing)
// followed by every settings group. The mirror of `module-section-nav.tsx` for
// the one platform-level surface that has sub-pages worth a panel. Items only —
// no <nav>, no provider. The desktop contextual panel wraps these in a
// module-colored scrolling <nav>; the mobile drawer drops them into a labeled
// section. Settings has no module color, so the caller wraps in
// ModuleProvider "platform" (neutral indigo) for the active highlight.
//
// `ready: false` groups have no page yet → rendered as disabled rows, matching
// the "Soon" cards on the settings landing page.

function isWithin(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsSectionItems({ pathname }: { pathname: string | null }) {
  return (
    <>
      <SidebarItem
        asChild
        active={pathname === '/settings'}
        icon={<SettingsIcon className="h-4 w-4" />}
      >
        <Link href="/settings">Overview</Link>
      </SidebarItem>
      {SETTINGS_NAV.map((item) => {
        const Icon = item.icon;
        if (!item.ready) {
          return (
            <SidebarItem key={item.id} disabled icon={<Icon className="h-4 w-4" />}>
              {item.label}
            </SidebarItem>
          );
        }
        // The landing page is "Overview"; a group is active only when the path
        // is the group itself or a descendant — never the bare /settings root.
        const active = pathname !== '/settings' && isWithin(pathname, item.href);
        return (
          <SidebarItem key={item.id} asChild active={active} icon={<Icon className="h-4 w-4" />}>
            <Link href={item.href}>{item.label}</Link>
          </SidebarItem>
        );
      })}
    </>
  );
}
