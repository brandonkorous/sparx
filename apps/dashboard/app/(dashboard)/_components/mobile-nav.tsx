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
import {
  Gauge,
  Handshake,
  Home,
  Landmark,
  Plus,
  Search,
  Settings,
  Store,
  Workflow,
} from 'lucide-react';
import { getManifestForPath, moduleManifests } from '../_shell/registry';
import type { FavoriteRow, RecentRow } from '../_shell/service';
import { FavoritesSection } from './favorites-section';
import { FinanceSectionItems } from './finance-section-nav';
import { ModuleSectionItems } from './module-section-nav';
import { PartnerSectionItems } from './partner-section-nav';
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
  /** Whether the tenant has a `partners` row (docs/114 §B.7). */
  isPartner: boolean;
  /** Whether the current user may operate the partner practice (owner/admin/
   *  partner) — hides the practice sections from members who can't act on them. */
  canOperatePartner: boolean;
}

export function MobileNav({
  pathname,
  enabledModules,
  favorites,
  recents,
  isPartner,
  canOperatePartner,
}: MobileNavProps) {
  const visible = moduleManifests.filter((m) => enabledModules.includes(m.id));
  const manifest = pathname ? getManifestForPath(pathname) : undefined;
  // A module with no sections (e.g. AI, overview-only for now) has nothing to
  // list beside "Overview" itself — mirrors the desktop contextual panel.
  const activeModule =
    manifest && manifest.sections.length > 0 && enabledModules.includes(manifest.id)
      ? manifest
      : undefined;
  const inSettings = pathname === '/settings' || (pathname?.startsWith('/settings/') ?? false);
  const inFinance = pathname === '/finance' || (pathname?.startsWith('/finance/') ?? false);
  const inPartner = pathname === '/partner' || (pathname?.startsWith('/partner/') ?? false);

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
              (docs/81 §1; docs/84 Slice G-UI). Mirrors the desktop rail tile: it
              owns a brand color (fuchsia), so it's wrapped in its ModuleProvider
              and `moduleIcon` carries the hue, just like the module tiles above. */}
          {enabledModules.length > 0 && (
            <ModuleProvider module="automations">
              <SidebarItem
                moduleIcon
                asChild
                active={
                  pathname === '/automations' || (pathname?.startsWith('/automations/') ?? false)
                }
                icon={<Workflow className="h-4 w-4" />}
              >
                <Link href="/automations">Automations</Link>
              </SidebarItem>
            </ModuleProvider>
          )}
          {/* SEO — cross-cutting platform tool (audits every module's pages),
              not an activatable module; rides at the end of the module list and
              is always present (unlike Automations, it isn't module-gated). Owns a
              brand color (yellow), so it's wrapped in its ModuleProvider and
              `moduleIcon` carries the hue. Mirrors the desktop rail (docs/50 §7). */}
          <ModuleProvider module="seo">
            <SidebarItem
              moduleIcon
              asChild
              active={pathname === '/seo' || (pathname?.startsWith('/seo/') ?? false)}
              icon={<Gauge className="h-4 w-4" />}
            >
              <Link href="/seo">SEO</Link>
            </SidebarItem>
          </ModuleProvider>
        </SidebarSection>

        <FavoritesSection favorites={favorites} />
        <RecentsSection recents={recents} favorites={favorites} />

        {/* Bottom cluster — mirrors the desktop rail's pinned group below the
            divider: Add a module → Marketplace → Settings (docs/24 §5, docs/54).
            "Add a module" is the single ambient upgrade pointer, shown only when a
            billable module is inactive. Both stay neutral-colored (platform-level,
            no module hue). */}
        <SidebarSection>
          {hasInactiveModules && (
            <SidebarItem asChild icon={<Plus className="h-4 w-4" />}>
              <Link href="/settings/modules">Add a module</Link>
            </SidebarItem>
          )}
          <SidebarItem
            asChild
            active={pathname === '/marketplace' || (pathname?.startsWith('/marketplace/') ?? false)}
            icon={<Store className="h-4 w-4" />}
          >
            <Link href="/marketplace">Marketplace</Link>
          </SidebarItem>
        </SidebarSection>

        {/* Finance — a first-class platform area (docs/109) that owns a brand hue
            (money green). Mirrors the desktop rail/panel: the switcher glyph always
            carries the finance color (moduleIcon, like SEO/Automations), and inside
            Finance the active section row goes green via the same "finance" provider. */}
        {inFinance ? (
          <ModuleProvider module="finance">
            <SidebarSection>
              <SidebarSectionLabel>Finance</SidebarSectionLabel>
              <FinanceSectionItems pathname={pathname} />
            </SidebarSection>
          </ModuleProvider>
        ) : (
          <SidebarSection>
            <ModuleProvider module="finance">
              <SidebarItem moduleIcon asChild icon={<Landmark className="h-4 w-4" />}>
                <Link href="/finance">Finance</Link>
              </SidebarItem>
            </ModuleProvider>
          </SidebarSection>
        )}

        {/* Partner Portal — a first-class platform area (docs/114 §B.7) that owns a
            brand hue (violet). Mirrors the desktop rail/panel. PARTNERS-ONLY: the
            switcher tile shows only to authorized users of a partner tenant; a
            non-partner joins through the public sparx.works/partners application
            form, not a permanent tile. (The in-portal section still renders when
            already on /partner so a deep link isn't stranded.) */}
        {inPartner ? (
          <ModuleProvider module="partner">
            <SidebarSection>
              <SidebarSectionLabel>Partner</SidebarSectionLabel>
              <PartnerSectionItems
                pathname={pathname}
                isPartner={isPartner}
                canOperatePartner={canOperatePartner}
              />
            </SidebarSection>
          </ModuleProvider>
        ) : isPartner && canOperatePartner ? (
          <SidebarSection>
            <ModuleProvider module="partner">
              <SidebarItem moduleIcon asChild icon={<Handshake className="h-4 w-4" />}>
                <Link href="/partner">Partner</Link>
              </SidebarItem>
            </ModuleProvider>
          </SidebarSection>
        ) : null}

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
