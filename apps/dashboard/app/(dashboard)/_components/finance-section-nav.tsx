'use client';

import * as React from 'react';
import Link from 'next/link';
import { SidebarItem, usePanelCollapsed } from '@sparx/ui';
import { Landmark } from 'lucide-react';
import { FINANCE_NAV, FINANCE_FLOW_LABELS, type FinanceFlow } from '../finance/nav';

// Finance's intra-area navigation: an "Overview" entry (the hub root) followed by
// every section, split by money-flow (docs/109 §4.1) — the "you get paid" group,
// then a divider + the "you pay sparx" group. The mirror of `settings-section-nav.tsx`
// for the other first-class platform surface. Items only — no <nav>, no provider.
// The desktop contextual panel wraps these in a scrolling <nav>; the mobile drawer
// drops them into a labeled section. Finance has no module color, so the caller
// wraps in ModuleProvider "platform" (neutral) for the active highlight.
//
// `ready: false` sections (their slice in docs/110 hasn't landed) render as
// disabled rows, matching the "Soon" cards on the hub landing.

function isWithin(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The money-flow divider rendered between the "in" group and the "sparx" group —
// the binding visual split (docs/109 §4.1) carried into the panel. Sentence-case,
// muted (not an uppercase kicker); collapsed it degrades to a bare rule.
function FlowDivider({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div aria-hidden className="my-1 h-px w-7 self-center bg-[var(--color-border-default)]" />
    );
  }
  return (
    <div className="mt-3 mb-1 border-t border-[var(--color-border-subtle)] px-2 pt-2">
      <span className="text-xs font-medium text-[var(--color-text-tertiary)]">{label}</span>
    </div>
  );
}

export function FinanceSectionItems({ pathname }: { pathname: string | null }) {
  // Inside a collapsed contextual panel the rows render icon-only (tooltipped).
  const collapsed = usePanelCollapsed();
  let prevGroup: FinanceFlow | null = null;
  return (
    <>
      <SidebarItem
        asChild
        active={pathname === '/finance'}
        collapsed={collapsed}
        icon={<Landmark className="h-4 w-4" />}
      >
        <Link href="/finance">Overview</Link>
      </SidebarItem>
      {FINANCE_NAV.map((item) => {
        const Icon = item.icon;
        const showDivider = prevGroup !== null && item.group !== prevGroup;
        prevGroup = item.group;
        const divider = showDivider ? (
          <FlowDivider label={FINANCE_FLOW_LABELS[item.group]} collapsed={collapsed} />
        ) : null;

        if (!item.ready) {
          return (
            <React.Fragment key={item.id}>
              {divider}
              <SidebarItem
                disabled
                collapsed={collapsed}
                title={item.label}
                icon={<Icon className="h-4 w-4" />}
              >
                {item.label}
              </SidebarItem>
            </React.Fragment>
          );
        }
        // The hub root is "Overview"; a section is active only when the path is the
        // section itself or a descendant — never the bare /finance root.
        const active = pathname !== '/finance' && isWithin(pathname, item.href);
        return (
          <React.Fragment key={item.id}>
            {divider}
            <SidebarItem
              asChild
              active={active}
              collapsed={collapsed}
              icon={<Icon className="h-4 w-4" />}
            >
              <Link href={item.href}>{item.label}</Link>
            </SidebarItem>
          </React.Fragment>
        );
      })}
    </>
  );
}
