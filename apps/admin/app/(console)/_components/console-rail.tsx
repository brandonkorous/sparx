'use client';

import Link from 'next/link';
import { cn, useRailExpanded, Wordmark } from '@sparx/ui';
import type { OperatorCapability } from '@sparx/operator';
import {
  CONSOLE_NAV_GROUPS,
  isNavItemActive,
  visibleItems,
  type ConsoleNavItem,
} from './console-nav-items';

// The operator console's icon rail (docs/apps/admin/build-plan.md) — modeled on
// the dashboard's rail (apps/dashboard `_components/rail-nav.tsx`): the same
// h-8 tiles, two-tone icon coloring, and expand-to-labels behavior owned by the
// shared SidebarAppShell (`useRailExpanded`). Collapsed it's icon-only with hover
// titles; expanded, every tile grows a label and each group gains a heading. The
// console wears the neutral `platform` hue, so the active tile uses the
// active-module bridge (`text-module`/`bg-module`, platform indigo) rather than per-module colors.

const TILE_BASE =
  'group relative flex h-8 items-center rounded-md text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none';
const TILE_INACTIVE = 'text-base-content/70 hover:bg-base-200 hover:text-base-content';
const TILE_ACTIVE = 'bg-module bg-soft text-module';

function tileClass(active: boolean, expanded: boolean): string {
  const shape = expanded ? 'w-full justify-start gap-2 px-2' : 'w-8 justify-center';
  return cn(TILE_BASE, shape, active ? TILE_ACTIVE : TILE_INACTIVE);
}

function tileIconClass(active: boolean): string {
  return cn(
    'inline-flex h-4 w-4 shrink-0 items-center justify-center',
    active ? 'text-module' : 'text-base-content/50 group-hover:text-base-content/70'
  );
}

function Tile({
  item,
  pathname,
  expanded,
}: {
  item: ConsoleNavItem;
  pathname: string | null;
  expanded: boolean;
}) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={tileClass(active, expanded)}
    >
      <span className={tileIconClass(active)}>
        <Icon className="h-4 w-4" />
      </span>
      {expanded ? <span className="flex-1 truncate text-left">{item.label}</span> : null}
    </Link>
  );
}

export function ConsoleRail({
  pathname,
  capabilities,
}: {
  pathname: string | null;
  capabilities: OperatorCapability[];
}) {
  const expanded = useRailExpanded();

  return (
    <>
      <div
        className={cn('flex items-center', expanded ? 'w-full gap-2 px-2 py-1' : 'justify-center')}
      >
        <Wordmark icon={!expanded} className={expanded ? 'h-5 w-auto' : 'h-5 w-5'} />
      </div>

      <div
        aria-hidden
        className={cn('bg-base-300 my-1 h-px shrink-0', expanded ? 'w-full' : 'w-7')}
      />

      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto',
          expanded ? 'items-stretch' : 'items-center'
        )}
      >
        {CONSOLE_NAV_GROUPS.map((group, i) => {
          const items = visibleItems(group, capabilities);
          if (items.length === 0) return null;
          return (
            <div
              key={group.label ?? 'overview'}
              className={cn('flex w-full flex-col gap-1', expanded ? '' : 'items-center')}
            >
              {group.label ? (
                expanded ? (
                  <div className="text-base-content/50 px-2 pt-3 pb-0.5 text-xs font-medium tracking-wider uppercase">
                    {group.label}
                  </div>
                ) : (
                  i > 0 && <div aria-hidden className="bg-base-300 my-1 h-px w-7 shrink-0" />
                )
              ) : null}
              {items.map((item) => (
                <Tile key={item.href} item={item} pathname={pathname} expanded={expanded} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
