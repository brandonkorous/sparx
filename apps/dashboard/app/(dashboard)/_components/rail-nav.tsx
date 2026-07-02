'use client';

import * as React from 'react';
import Link from 'next/link';
import { ModuleProvider, useRailExpanded, Wordmark } from '@sparx/ui';
import {
  Clock,
  Gauge,
  Handshake,
  Home,
  Landmark,
  Plus,
  Search,
  Settings,
  Star,
  Store,
  Workflow,
} from 'lucide-react';
import {
  moduleManifests,
  findFavoritableById,
  findFavoritableByPath,
  type FavoritableItem,
} from '../_shell/registry';
import type { FavoriteRow, RecentRow } from '../_shell/service';
import { recordVisitAction } from '../_shell/actions';

// The icon rail — the primary sidebar (docs/24 §5). Module switching plus the
// cross-module shortcuts that need to be reachable from anywhere: Home, Search,
// Favorites, Recents, Settings. The active module's tile adopts its color via
// ModuleProvider. The contextual panel beside it stays purely about the current
// module's sections.
//
// Collapsed, the rail is icon-only (favorites/recents show as their item icons
// with hover labels); expanded (persisted toggle, owned by the shell) every
// tile grows a text label and the Favorites/Recents groups gain headings.
// Account control lives in the top toolbar, not here.

const RECENTS_LIMIT = 8;

// The rail tiles mirror the module sidebar's `SidebarItem` (packages/ui
// navigation/sidebar.tsx) so the primary and contextual navs read at the same
// scale: h-8 rows, rounded-md, gap-2, text-sm, and the same tint active state.
// `group` lets the icon adopt SidebarItem's two-tone hover coloring.
const TILE_BASE =
  'group relative flex h-8 items-center rounded-md text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none';
const TILE_INACTIVE =
  'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]';
const TILE_ACTIVE = 'bg-[var(--module-active-tint)] text-[var(--module-active-text)]';

function tileClass(active: boolean, expanded: boolean) {
  const shape = expanded ? 'w-full justify-start gap-2 px-2' : 'w-8 justify-center';
  return `${TILE_BASE} ${shape} ${active ? TILE_ACTIVE : TILE_INACTIVE}`;
}

// Matches SidebarItem's icon wrapper: the glyph is tinted independently of the
// label — module color when active, a quiet tertiary→secondary on hover when not.
function tileIconClass(active: boolean) {
  return `inline-flex h-4 w-4 shrink-0 items-center justify-center ${
    active
      ? 'text-[var(--module-active)]'
      : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]'
  }`;
}

// Module tiles always carry their own module color on the glyph, active or not,
// so the rail reads as a color-coded module switcher (Commerce orange, CMS teal,
// …). Each module tile is wrapped in its own ModuleProvider, so --module-active
// resolves per-module here. Favorites/Recents items reuse this too — each is a
// module-owned section/action, so it rides under its module's ModuleProvider and
// the glyph adopts that module's color (a CRM favorite reads cyan, a Commerce
// one orange). Automations and SEO are platform surfaces (not in moduleManifests)
// but each owns a brand color, so they're wrapped in a ModuleProvider and use this
// too (fuchsia / yellow) — and Finance now joins them (money green, docs/109). Only
// the true neutral shortcuts (Home/Search/Marketplace/Settings) keep the neutral
// tileIconClass since they have no module color.
const MODULE_TILE_ICON =
  'inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--module-active)]';

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

function openCommandPalette() {
  window.dispatchEvent(new Event('sparx:open-command-palette'));
}

interface RailNavProps {
  pathname: string | null;
  enabledModules: readonly string[];
  favorites: FavoriteRow[];
  recents: RecentRow[];
  /** Whether the tenant has a `partners` row (docs/114 §B.7). The Partner tile is
   *  always shown — a non-partner lands on the join screen — but this tunes the
   *  tooltip so the pointer reads as "join" vs "your portal". */
  isPartner: boolean;
}

export function RailNav({ pathname, enabledModules, favorites, recents, isPartner }: RailNavProps) {
  const visible = moduleManifests.filter((m) => enabledModules.includes(m.id));
  const expanded = useRailExpanded();

  // Whether any billable module is inactive — drives the single "Add a module"
  // entry (Option A: one ambient upgrade pointer, not a locked tile per module).
  // The legacy `storefront` manifest is the `builder` module's alias, not a
  // separately activatable unit, so it's excluded from the comparison.
  const hasInactiveModules = moduleManifests.some(
    (m) => m.id !== 'storefront' && !enabledModules.includes(m.id)
  );

  // Optimistic recents (mirrors the former panel section): on navigation,
  // promote the current path to the top of the local list and fire the server
  // upsert. Server reconciliation happens on the next full load.
  const [localRecents, setLocalRecents] = React.useState<RecentRow[]>(recents);
  React.useEffect(() => setLocalRecents(recents), [recents]);
  React.useEffect(() => {
    if (!pathname) return;
    const item = findFavoritableByPath(pathname);
    if (!item) return;
    setLocalRecents((prev) => [
      { actionId: item.id, lastVisitedAt: new Date().toISOString() },
      ...prev.filter((r) => r.actionId !== item.id),
    ]);
    void recordVisitAction(item.id);
  }, [pathname]);

  const favItems = favorites.flatMap((f) => {
    const item = findFavoritableById(f.actionId);
    return item ? [item] : [];
  });
  const recentItems = localRecents
    .flatMap((r) => {
      const item = findFavoritableById(r.actionId);
      return item ? [item] : [];
    })
    .slice(0, RECENTS_LIMIT);

  return (
    <>
      <div
        className={`flex items-center ${expanded ? 'w-full gap-2 px-2 py-1' : 'justify-center'}`}
      >
        <Wordmark icon={expanded ? false : true} className={expanded ? 'h-5 w-auto' : 'h-5 w-5'} />
      </div>

      <button
        type="button"
        onClick={openCommandPalette}
        title="Search  ⌘K"
        aria-label="Search"
        className={tileClass(false, expanded)}
      >
        <span className={tileIconClass(false)}>
          <Search className="h-4 w-4" />
        </span>
        {expanded && <span className="flex-1 truncate text-left">Search</span>}
      </button>

      <Link
        href="/"
        title="Home"
        aria-label="Home"
        className={tileClass(pathname === '/', expanded)}
      >
        <span className={tileIconClass(pathname === '/')}>
          <Home className="h-4 w-4" />
        </span>
        {expanded && <span className="flex-1 truncate text-left">Home</span>}
      </Link>

      <RailDivider expanded={expanded} />

      {/* Scrollable middle — modules + shortcuts. Brand/Search/Home stay pinned
          above, Settings + the expand toggle stay pinned below. */}
      <div
        className={`flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto ${
          expanded ? 'items-stretch' : 'items-center'
        }`}
      >
        {visible.map((manifest) => {
          const Icon = manifest.icon;
          const active = isActivePath(pathname, manifest.routePrefix);
          return (
            <ModuleProvider key={manifest.id} module={manifest.id}>
              <Link
                href={manifest.routePrefix}
                title={manifest.label}
                aria-label={manifest.label}
                aria-current={active ? 'page' : undefined}
                className={tileClass(active, expanded)}
              >
                <span className={MODULE_TILE_ICON}>
                  <Icon className="h-4 w-4" />
                </span>
                {expanded && <span className="flex-1 truncate text-left">{manifest.label}</span>}
              </Link>
            </ModuleProvider>
          );
        })}

        {/* Automations — a platform CAPABILITY, not an activatable module
            (docs/81 §1, §3): a cross-module rule engine reachable whenever the
            tenant has ≥1 trigger-capable module active. Like SEO it rides at the
            end of the module list and is not in `moduleManifests`, but it owns a
            brand color (fuchsia) — so, like the module tiles, it's wrapped in its
            ModuleProvider and the glyph carries its module hue. See docs/84 Slice G-UI. */}
        {enabledModules.length > 0 && (
          <ModuleProvider module="automations">
            <Link
              href="/automations"
              title="Automations"
              aria-label="Automations"
              aria-current={isActivePath(pathname, '/automations') ? 'page' : undefined}
              className={tileClass(isActivePath(pathname, '/automations'), expanded)}
            >
              <span className={MODULE_TILE_ICON}>
                <Workflow className="h-4 w-4" />
              </span>
              {expanded && <span className="flex-1 truncate text-left">Automations</span>}
            </Link>
          </ModuleProvider>
        )}

        {/* SEO — a cross-cutting platform tool (audits every module's pages:
            products, collections, CMS + Builder pages), not an activatable
            module. It rides at the END of the module list rather than in a
            module manifest, but it owns a brand color (yellow) — so, like the
            module tiles, it's wrapped in its ModuleProvider and the glyph carries
            its module hue. New modules append above it. See docs/50 §7. */}
        <ModuleProvider module="seo">
          <Link
            href="/seo"
            title="SEO"
            aria-label="SEO"
            aria-current={isActivePath(pathname, '/seo') ? 'page' : undefined}
            className={tileClass(isActivePath(pathname, '/seo'), expanded)}
          >
            <span className={MODULE_TILE_ICON}>
              <Gauge className="h-4 w-4" />
            </span>
            {expanded && <span className="flex-1 truncate text-left">SEO</span>}
          </Link>
        </ModuleProvider>

        <RailGroup
          label="Favorites"
          groupIcon={Star}
          items={favItems}
          pathname={pathname}
          expanded={expanded}
        />
        <RailGroup
          label="Recents"
          groupIcon={Clock}
          items={recentItems}
          pathname={pathname}
          expanded={expanded}
        />
      </div>

      <RailDivider expanded={expanded} />

      {/* Option A: a single ambient "Add a module" pointer to the activation
          surface, shown only when there's something to add. Rendered inactive
          like Search — it's a CTA shortcut, not a primary destination (so it
          doesn't fight Settings for the active state on /settings/modules). */}
      {hasInactiveModules && (
        <Link
          href="/settings/modules"
          title="Add a module"
          aria-label="Add a module"
          className={tileClass(false, expanded)}
        >
          <span className={tileIconClass(false)}>
            <Plus className="h-4 w-4" />
          </span>
          {expanded && <span className="flex-1 truncate text-left">Add a module</span>}
        </Link>
      )}

      {/* Finance — a first-class platform area (docs/109): the one place to manage
          how you get paid, where your money lands, and what you pay sparx. Platform-
          level (not a module), so it pins to the bottom cluster — but it now owns a
          brand hue (money green), so like SEO/Automations it rides under its own
          ModuleProvider and the glyph always carries the finance color. */}
      <ModuleProvider module="finance">
        <Link
          href="/finance"
          title="Finance"
          aria-label="Finance"
          aria-current={isActivePath(pathname, '/finance') ? 'page' : undefined}
          className={tileClass(isActivePath(pathname, '/finance'), expanded)}
        >
          <span className={MODULE_TILE_ICON}>
            <Landmark className="h-4 w-4" />
          </span>
          {expanded && <span className="flex-1 truncate text-left">Finance</span>}
        </Link>
      </ModuleProvider>

      {/* Partner Portal — a first-class platform area (docs/114 §B.7), not a
          module, so it pins to the bottom cluster beside Finance. It owns a brand
          hue (violet), so like Finance it rides under its own ModuleProvider and
          the glyph always carries the partner color. The tile is ALWAYS shown: a
          non-partner lands on the "Become a partner" join screen — the tooltip
          distinguishes joining from returning to your portal. */}
      <ModuleProvider module="partner">
        <Link
          href="/partner"
          title={isPartner ? 'Partner' : 'Become a partner'}
          aria-label={isPartner ? 'Partner' : 'Become a partner'}
          aria-current={isActivePath(pathname, '/partner') ? 'page' : undefined}
          className={tileClass(isActivePath(pathname, '/partner'), expanded)}
        >
          <span className={MODULE_TILE_ICON}>
            <Handshake className="h-4 w-4" />
          </span>
          {expanded && <span className="flex-1 truncate text-left">Partner</span>}
        </Link>
      </ModuleProvider>

      {/* Marketplace — blueprints now, integrations soon (docs/54): one-click
          install of a whole themed site, with more categories to come. Platform-
          level, not a module, so it pins to the bottom cluster beside Settings.
          (SEO moved to the end of the module list above.) */}
      <Link
        href="/marketplace"
        title="Marketplace"
        aria-label="Marketplace"
        className={tileClass(isActivePath(pathname, '/marketplace'), expanded)}
      >
        <span className={tileIconClass(isActivePath(pathname, '/marketplace'))}>
          <Store className="h-4 w-4" />
        </span>
        {expanded && <span className="flex-1 truncate text-left">Marketplace</span>}
      </Link>

      <Link
        href="/settings"
        title="Settings"
        aria-label="Settings"
        className={tileClass(isActivePath(pathname, '/settings'), expanded)}
      >
        <span className={tileIconClass(isActivePath(pathname, '/settings'))}>
          <Settings className="h-4 w-4" />
        </span>
        {expanded && <span className="flex-1 truncate text-left">Settings</span>}
      </Link>
    </>
  );
}

function RailDivider({ expanded }: { expanded: boolean }) {
  return (
    <div
      aria-hidden
      className={`my-1 h-px shrink-0 bg-[var(--color-border-default)] ${expanded ? 'w-full' : 'w-7'}`}
    />
  );
}

interface RailGroupProps {
  label: string;
  groupIcon: React.ComponentType<{ className?: string }>;
  items: FavoritableItem[];
  pathname: string | null;
  expanded: boolean;
}

// Renders a shortcut group (Favorites / Recents). Empty groups are omitted to
// keep the narrow rail uncluttered. Expanded shows a text heading; collapsed
// shows the group glyph as a quiet section marker.
function RailGroup({ label, groupIcon: GroupIcon, items, pathname, expanded }: RailGroupProps) {
  if (items.length === 0) return null;
  return (
    // Collapsed, the fixed-width `w-8` tiles must be centered in the narrow rail
    // like the module tiles above; expanded, they stretch full-width for labels.
    <div className={`mt-1 flex w-full flex-col gap-1 ${expanded ? '' : 'items-center'}`}>
      {expanded ? (
        <div className="px-3 pt-2 pb-0.5 text-xs font-medium tracking-wider text-[var(--color-text-tertiary)] uppercase">
          {label}
        </div>
      ) : (
        <div className="my-0.5 flex justify-center" title={label}>
          <GroupIcon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        // Wrap each item in its module's provider so the glyph (and the active
        // tint) resolve to that module's color — mirrors the module tiles above.
        return (
          <ModuleProvider key={item.id} module={item.moduleId}>
            <Link
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={tileClass(active, expanded)}
            >
              <span className={MODULE_TILE_ICON}>
                <Icon className="h-4 w-4" />
              </span>
              {expanded && <span className="flex-1 truncate text-left">{item.label}</span>}
            </Link>
          </ModuleProvider>
        );
      })}
    </div>
  );
}
