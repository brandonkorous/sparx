'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ModuleProvider,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarSectionLabel,
  Stack,
  Text,
  Wordmark,
} from '@sparx/ui';
import { Home, Plus, Search, Settings, Workflow } from 'lucide-react';
import { getManifestForPath, moduleManifests } from '../_shell/registry';
import type { FavoriteRow, RecentRow } from '../_shell/service';
import { FavoritesSection } from './favorites-section';
import { ModuleSectionItems } from './module-section-nav';
import { RecentsSection } from './recents-section';
import { SettingsSectionItems } from './settings-section-nav';

// Mobile nav — the rail + contextual panel translated to a single vertical
// drawer (below md). One coherent model: switch modules, see the current
// module's sections, and reach Favorites/Recents — the same affordances the
// desktop rail + panel expose. See docs/24 §5.

function openCommandPalette() {
  window.dispatchEvent(new Event('sparx:open-command-palette'));
}

interface MobileNavProps {
  pathname: string | null;
  enabledModules: readonly string[];
  favorites: FavoriteRow[];
  recents: RecentRow[];
}

export function MobileNav({ pathname, enabledModules, favorites, recents }: MobileNavProps) {
  const visible = moduleManifests.filter((m) => enabledModules.includes(m.id));
  const manifest = pathname ? getManifestForPath(pathname) : undefined;
  const activeModule = manifest && enabledModules.includes(manifest.id) ? manifest : undefined;
  const inSettings = pathname === '/settings' || (pathname?.startsWith('/settings/') ?? false);

  // One ambient "Add a module" pointer (Option A), shown only when a billable
  // module is inactive. `storefront` is the `builder` alias, not a separate
  // activatable unit, so it's excluded from the comparison.
  const hasInactiveModules = moduleManifests.some(
    (m) => m.id !== 'storefront' && !enabledModules.includes(m.id)
  );

  return (
    <>
      <SidebarHeader>
        <Stack gap={0}>
          <Wordmark size={18} icon />
          <Text size="xs" variant="muted">
            Dashboard
          </Text>
        </Stack>
      </SidebarHeader>

      <SidebarNav>
        <SidebarSection>
          <SidebarItem icon={<Search className="h-4 w-4" />} onClick={openCommandPalette}>
            Search
          </SidebarItem>
          <SidebarItem asChild active={pathname === '/'} icon={<Home className="h-4 w-4" />}>
            <Link href="/">Home</Link>
          </SidebarItem>
        </SidebarSection>

        {activeModule && (
          <ModuleProvider module={activeModule.id}>
            <SidebarSection>
              <SidebarSectionLabel>{activeModule.label}</SidebarSectionLabel>
              <ModuleSectionItems manifest={activeModule} pathname={pathname} />
            </SidebarSection>
          </ModuleProvider>
        )}

        <SidebarSection>
          <SidebarSectionLabel>Modules</SidebarSectionLabel>
          {visible.map((m) => {
            const Icon = m.icon;
            const active =
              pathname === m.routePrefix || (pathname?.startsWith(`${m.routePrefix}/`) ?? false);
            return (
              <ModuleProvider key={m.id} module={m.id}>
                <SidebarItem moduleIcon asChild active={active} icon={<Icon className="h-4 w-4" />}>
                  <Link href={m.routePrefix}>{m.label}</Link>
                </SidebarItem>
              </ModuleProvider>
            );
          })}
          {/* Automations — platform capability, reachable with ≥1 module active
              (docs/81 §1; docs/84 Slice G-UI). Mirrors the desktop rail tile. */}
          {enabledModules.length > 0 && (
            <SidebarItem
              asChild
              active={
                pathname === '/automations' || (pathname?.startsWith('/automations/') ?? false)
              }
              icon={<Workflow className="h-4 w-4" />}
            >
              <Link href="/automations">Automations</Link>
            </SidebarItem>
          )}
          {hasInactiveModules && (
            <SidebarItem asChild icon={<Plus className="h-4 w-4" />}>
              <Link href="/settings/modules">Add a module</Link>
            </SidebarItem>
          )}
        </SidebarSection>

        <FavoritesSection favorites={favorites} />
        <RecentsSection recents={recents} favorites={favorites} />

        {inSettings ? (
          <ModuleProvider module="platform">
            <SidebarSection>
              <SidebarSectionLabel>Settings</SidebarSectionLabel>
              <SettingsSectionItems pathname={pathname} />
            </SidebarSection>
          </ModuleProvider>
        ) : (
          <SidebarSection>
            <SidebarItem asChild icon={<Settings className="h-4 w-4" />}>
              <Link href="/settings">Settings</Link>
            </SidebarItem>
          </SidebarSection>
        )}
      </SidebarNav>
    </>
  );
}
