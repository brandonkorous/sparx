'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SidebarAppShell } from '@sparx/ui';
import type { Property } from '@/lib/sites';
import type { FavoriteRow, RecentRow } from '../_shell/service';
import type { UserPreferences } from '../_shell/preferences-types';
import { BreadcrumbTrail } from './breadcrumb-trail';
import { CommandPalette } from './command-palette';
import { ContextualPanel, resolvePanelContext } from './contextual-panel';
import { DashboardHeader } from './dashboard-header';
import { FeedbackProvider } from './feedback/feedback-provider';
import { InlineDetailContent, ModalDetailContent, useDetailTarget } from './detail-panel';
import { MobileNav } from './mobile-nav';
import { PreferencesProvider } from './preferences-provider';
import { RailNav } from './rail-nav';
import { UserMenu } from './user-menu';

export interface DashboardShellProps {
  user: { id: string; email: string; name?: string | null };
  tenantName: string;
  /** Module slugs active for this tenant (manifest ids). Filters the rail,
   *  contextual panel, mobile nav, and breadcrumb module switcher so a tenant
   *  never sees a module it hasn't activated. */
  enabledModules: readonly string[];
  /** The tenant's web properties (sites) + the active one (docs/49) — feeds the
   *  breadcrumb Site switcher. Empty / single-site → no Site segment. */
  sites?: Property[];
  activePropertyId?: string | null;
  favorites: FavoriteRow[];
  recents: RecentRow[];
  preferences: UserPreferences;
  children: React.ReactNode;
  /** Server-rendered detail body from the `@detail` slot (null when closed). */
  detail?: React.ReactNode;
}

export function DashboardShell({
  user,
  tenantName,
  enabledModules,
  sites = [],
  activePropertyId = null,
  favorites,
  recents,
  preferences,
  children,
  detail,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailTarget = useDetailTarget();
  const trimmedName = user.name?.trim();
  const emailLocal = user.email.split('@')[0] ?? user.email;
  const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : emailLocal;

  const closeDetail = React.useCallback(() => {
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
  }, [pathname, router, searchParams]);

  // The detail body itself is server-rendered (the `@detail` slot). The shell
  // only decides where to mount it and wraps it in client chrome. `detail` is
  // null whenever no target is open, so the mode guards below stay in sync
  // with the slot.
  const inlineDetail =
    detailTarget?.mode === 'drawer' && detail ? (
      <InlineDetailContent target={detailTarget}>{detail}</InlineDetailContent>
    ) : null;

  // The contextual panel only exists inside a module or in settings. Everywhere
  // else (Home, Marketplace, SEO, …) there's nothing context-specific to show, so
  // we omit the panel entirely and the shell collapses the column — the rail
  // already carries the module switcher + platform links.
  const hasPanel = resolvePanelContext(pathname, enabledModules).kind !== 'none';

  // The active web property (site) for the feedback context payload (docs/112 §4).
  const activeSite = sites.find((s) => s.id === activePropertyId) ?? sites[0] ?? null;
  const activeProperty = activeSite ? { id: activeSite.id, name: activeSite.name } : null;

  return (
    <PreferencesProvider value={preferences}>
      <FeedbackProvider activeProperty={activeProperty}>
        <SidebarAppShell
          pathname={pathname}
          rail={
            <RailNav
              pathname={pathname}
              enabledModules={enabledModules}
              favorites={favorites}
              recents={recents}
            />
          }
          panel={
            hasPanel ? (
              <ContextualPanel
                pathname={pathname}
                enabledModules={enabledModules}
                tenantName={tenantName}
              />
            ) : null
          }
          mobileNav={
            <MobileNav
              pathname={pathname}
              enabledModules={enabledModules}
              favorites={favorites}
              recents={recents}
            />
          }
          headerStart={
            <BreadcrumbTrail
              tenantName={tenantName}
              enabledModules={enabledModules}
              sites={sites}
              activePropertyId={activePropertyId}
            />
          }
          headerActions={
            <>
              <DashboardHeader favorites={favorites} preferences={preferences} />
              <UserMenu user={user} displayName={displayName} />
            </>
          }
          detail={inlineDetail}
          onDetailClose={closeDetail}
        >
          {children}
        </SidebarAppShell>
        {/* Modal overlay is rendered separately — it's not part of the
          shell's split layout. */}
        {detailTarget?.mode === 'modal' && detail && (
          <ModalDetailContent target={detailTarget} onClose={closeDetail}>
            {detail}
          </ModalDetailContent>
        )}
        {/* ⌘K palette — mounted once at the shell, listens globally for the
          shortcut. Receives favorites + recents so they appear at the top
          of the search results without an extra fetch. */}
        <CommandPalette favorites={favorites} recents={recents} enabledModules={enabledModules} />
      </FeedbackProvider>
    </PreferencesProvider>
  );
}
