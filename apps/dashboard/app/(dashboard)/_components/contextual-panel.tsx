'use client';

import * as React from 'react';
import { ModuleProvider, SidebarNav, Text } from '@sparx/ui';
import type { ModuleManifest } from '@sparx/ui/shell';
import { getManifestForPath } from '../_shell/registry';
import { ModuleSectionItems } from './module-section-nav';
import { SettingsSectionItems } from './settings-section-nav';

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
}

export type PanelContext =
  | { kind: 'module'; manifest: ModuleManifest }
  | { kind: 'settings' }
  | { kind: 'none' };

function isSettingsPath(pathname: string | null): boolean {
  return pathname === '/settings' || (pathname?.startsWith('/settings/') ?? false);
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
  if (manifest && enabledModules.includes(manifest.id)) {
    return { kind: 'module', manifest };
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
        {dot && (
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--module-active)]" />
        )}
        <Text size="sm" weight="medium" className="truncate">
          {title}
        </Text>
      </div>
    </div>
  );
}

export function ContextualPanel({ pathname, enabledModules, tenantName }: ContextualPanelProps) {
  const ctx = resolvePanelContext(pathname, enabledModules);

  if (ctx.kind === 'module') {
    return (
      <ModuleProvider module={ctx.manifest.id} className="flex h-full flex-col">
        <PanelHead eyebrow="Module" title={ctx.manifest.label} dot />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav label="Sections" className="gap-0.5 px-2 pb-3">
            <ModuleSectionItems manifest={ctx.manifest} pathname={pathname} />
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
        <PanelHead eyebrow="Settings" title={tenantName} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav label="Settings" className="gap-0.5 px-2 pb-3">
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
