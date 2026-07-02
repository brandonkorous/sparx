'use client';

import * as React from 'react';
import Link from 'next/link';
import { SidebarItem, usePanelCollapsed } from '@sparx/ui';
import { LayoutDashboard } from 'lucide-react';
import { PARTNER_NAV } from '../partner/nav';

// The Partner Portal's intra-area navigation: an "Overview" entry (the portal
// root) followed by every section. The mirror of `finance-section-nav.tsx` for
// the other first-class platform surface. Items only — no <nav>, no provider; the
// desktop contextual panel wraps these in a scrolling <nav> and the mobile drawer
// drops them into a labeled section. The Partner area owns a hue (violet, docs/114
// §B.7), so the caller wraps in ModuleProvider "partner" — the active row glyph +
// tint go violet, exactly like a module's sections.
//
// `isPartner` gates the member-only sections (referrals, commissions, profile,
// bootcamps): a prospective partner sees only Overview, Tier, and Resources — the
// entries that make sense before joining — and unlocks the rest on join.

function isWithin(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PartnerSectionItems({
  pathname,
  isPartner,
}: {
  pathname: string | null;
  isPartner: boolean;
}) {
  // Inside a collapsed contextual panel the rows render icon-only (tooltipped).
  const collapsed = usePanelCollapsed();
  const items = PARTNER_NAV.filter((item) => isPartner || !item.memberOnly);
  return (
    <>
      <SidebarItem
        asChild
        active={pathname === '/partner'}
        collapsed={collapsed}
        icon={<LayoutDashboard className="h-4 w-4" />}
      >
        <Link href="/partner">Overview</Link>
      </SidebarItem>
      {items.map((item) => {
        const Icon = item.icon;
        // The portal root is "Overview"; a section is active only when the path is
        // the section itself or a descendant — never the bare /partner root.
        const active = pathname !== '/partner' && isWithin(pathname, item.href);
        return (
          <SidebarItem
            key={item.id}
            asChild
            active={active}
            collapsed={collapsed}
            icon={<Icon className="h-4 w-4" />}
          >
            <Link href={item.href}>{item.label}</Link>
          </SidebarItem>
        );
      })}
    </>
  );
}
