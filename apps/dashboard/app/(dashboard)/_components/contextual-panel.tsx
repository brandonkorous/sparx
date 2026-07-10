'use client';

import * as React from 'react';
import { ModuleProvider, SidebarNav, Text, usePanelCollapsed } from '@sparx/ui';
import { Handshake, Landmark, Settings as SettingsIcon } from 'lucide-react';
import type { ModuleManifest } from '@sparx/ui/shell';
import { getManifestForPath } from '../_shell/registry';
import { ModuleSectionItems } from './module-section-nav';
import { SettingsSectionItems } from './settings-section-nav';
import { FinanceSectionItems } from './finance-section-nav';
import { PartnerSectionItems } from './partner-section-nav';

// The contextual panel — the second column of the shell nav (docs/24 §5). It is
// purely about the current context:
//   • inside a module  → that module's sections (the intra-module nav)
//   • inside settings  → the settings sub-pages (settings has no module color,
//     so it borrows the same section slot under a neutral "platform" provider)
//   • anywhere else    → nothing; the shell hides the column entirely. The rail
//     already lists every module + Home/Marketplace/SEO/Settings, so a
//     platform-level panel would only echo the rail.
// Cross-module shortcuts (Favorites, Recents) live in the primary rail, not
// here, so the panel never competes with the rail for the same job.

interface ContextualPanelProps {
  pathname: string | null;
  enabledModules: readonly string[];
  tenantName: string;
  /** Whether the tenant has a `partners` row — gates the member-only sections. */
  isPartner: boolean;
  /** Whether the current user may operate the partner practice (owner/admin/
   *  partner). A non-operator sees only the Overview (locked) entry. */
  canOperatePartner: boolean;
}

export type PanelContext =
  | { kind: 'module'; manifest: ModuleManifest }
  | { kind: 'settings' }
  | { kind: 'finance' }
  | { kind: 'partner' }
  | { kind: 'none' };

function isSettingsPath(pathname: string | null): boolean {
  return pathname === '/settings' || (pathname?.startsWith('/settings/') ?? false);
}

function isFinancePath(pathname: string | null): boolean {
  return pathname === '/finance' || (pathname?.startsWith('/finance/') ?? false);
}

function isPartnerPath(pathname: string | null): boolean {
  return pathname === '/partner' || (pathname?.startsWith('/partner/') ?? false);
}

// What the contextual panel should render for a given route. Shared with the
// shell so it can hide the panel column outright when the answer is `none`
// (a React element always renders to *something*, so the shell can't infer
// emptiness from the node alone).
export function resolvePanelContext(
  pathname: string | null,
  enabledModules: readonly string[]
): PanelContext {
  const manifest = pathname ? getManifestForPath(pathname) : undefined;
  // A module with no sections (e.g. AI, which is overview-only for now) has
  // nothing to list beside "Overview" itself — same as a platform surface
  // like Automations, the panel column drops out rather than echoing the rail.
  if (manifest && manifest.sections.length > 0 && enabledModules.includes(manifest.id)) {
    return { kind: 'module', manifest };
  }
  if (isFinancePath(pathname)) {
    return { kind: 'finance' };
  }
  if (isPartnerPath(pathname)) {
    return { kind: 'partner' };
  }
  if (isSettingsPath(pathname)) {
    return { kind: 'settings' };
  }
  return { kind: 'none' };
}

function PanelHead({ eyebrow, title, dot }: { eyebrow: string; title: string; dot?: boolean }) {
  return (
    <div className="shrink-0 px-4 pt-4 pb-2">
      <Text size="xs" variant="muted" className="font-medium tracking-wider uppercase">
        {eyebrow}
      </Text>
      <div className="mt-0.5 flex items-center gap-2">
        {dot && <span aria-hidden className="bg-module h-2 w-2 shrink-0 rounded-full" />}
        <Text size="sm" weight="medium" className="truncate">
          {title}
        </Text>
      </div>
    </div>
  );
}

// Collapsed-strip header: the context's glyph centered (a quiet marker in place
// of the eyebrow + title), tooltipped with the full name.
function PanelHeadIcon({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex shrink-0 justify-center px-2 pt-4 pb-2" title={label}>
      <Icon className="text-module h-5 w-5" aria-hidden />
    </div>
  );
}

export function ContextualPanel({
  pathname,
  enabledModules,
  tenantName,
  isPartner,
  canOperatePartner,
}: ContextualPanelProps) {
  const ctx = resolvePanelContext(pathname, enabledModules);
  const collapsed = usePanelCollapsed();

  if (ctx.kind === 'module') {
    return (
      <ModuleProvider module={ctx.manifest.id} className="flex h-full flex-col">
        {collapsed ? (
          <PanelHeadIcon icon={ctx.manifest.icon} label={ctx.manifest.label} />
        ) : (
          <PanelHead eyebrow="Module" title={ctx.manifest.label} dot />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            label="Sections"
            className={collapsed ? 'items-center gap-0.5 px-1.5 pb-3' : 'gap-0.5 px-2 pb-3'}
          >
            <ModuleSectionItems manifest={ctx.manifest} pathname={pathname} />
          </SidebarNav>
        </div>
      </ModuleProvider>
    );
  }

  if (ctx.kind === 'finance') {
    // Finance is a first-class platform area that now owns a brand hue (money green,
    // docs/109) — wrap in its own "finance" provider so the panel glyph/dot and the
    // active section row resolve to finance green, exactly like a module's sections.
    // The money-flow split lives inside the items.
    return (
      <ModuleProvider module="finance" className="flex h-full flex-col">
        {collapsed ? (
          <PanelHeadIcon icon={Landmark} label="Finance" />
        ) : (
          <PanelHead eyebrow="Finance" title={tenantName} dot />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            label="Finance"
            className={collapsed ? 'items-center gap-0.5 px-1.5 pb-3' : 'gap-0.5 px-2 pb-3'}
          >
            <FinanceSectionItems pathname={pathname} />
          </SidebarNav>
        </div>
      </ModuleProvider>
    );
  }

  if (ctx.kind === 'partner') {
    // The Partner Portal is a first-class platform area that owns a brand hue
    // (violet, docs/114 §B.7) — wrap in its own "partner" provider so the panel
    // glyph/dot and the active section row resolve to violet, exactly like a
    // module's sections. Member-only sections stay hidden until the tenant joins.
    return (
      <ModuleProvider module="partner" className="flex h-full flex-col">
        {collapsed ? (
          <PanelHeadIcon icon={Handshake} label="Partner" />
        ) : (
          <PanelHead eyebrow="Partner" title={tenantName} dot />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            label="Partner"
            className={collapsed ? 'items-center gap-0.5 px-1.5 pb-3' : 'gap-0.5 px-2 pb-3'}
          >
            <PartnerSectionItems
              pathname={pathname}
              isPartner={isPartner}
              canOperatePartner={canOperatePartner}
            />
          </SidebarNav>
        </div>
      </ModuleProvider>
    );
  }

  if (ctx.kind === 'settings') {
    // Settings isn't a module (no color of its own) — wrap in the neutral
    // "platform" provider so the active row picks up a sensible highlight.
    return (
      <ModuleProvider module="platform" className="flex h-full flex-col">
        {collapsed ? (
          <PanelHeadIcon icon={SettingsIcon} label={tenantName} />
        ) : (
          <PanelHead eyebrow="Settings" title={tenantName} />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            label="Settings"
            className={collapsed ? 'items-center gap-0.5 px-1.5 pb-3' : 'gap-0.5 px-2 pb-3'}
          >
            <SettingsSectionItems pathname={pathname} />
          </SidebarNav>
        </div>
      </ModuleProvider>
    );
  }

  // No contextual nav here — the shell drops the panel column (see
  // resolvePanelContext usage in dashboard-shell.tsx).
  return null;
}
