'use client';

// The navigation panel — a BROWSER, not a mirror.
//
// This is where the console deliberately departs from an ordinary sidebar. A
// contextual panel normally reflects the section you are *in*; here a person can
// have things from five apps open at once, so there is no "in" to reflect. The
// panel shows the app you asked to BROWSE. Picking Sell in the rail means "show
// me what Sell has", never "go to Sell", and nothing about the panel changes
// when the focus moves to another pane.
//
// Everything it lists is derived from the app registry crossed with the surface
// registry (lib/console/nav.ts), so a screen cannot exist without being
// reachable from here.
//
// Built from silicaui's <Sidebar> primitives — SidebarGroup/GroupLabel for
// sections, SidebarItem for rows, and a sibling button for the quick-create `+`.

import { useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  SearchInput,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarHeaderBrand,
  SidebarItem,
  Text,
  Tooltip,
} from '@wizeworks/silicaui-react';
import {
  resolveTitle,
  type OpenTarget,
  type SurfaceDefinition,
} from '@workbench/lib/surfaces/registry';
import { useWorkbench } from '@workbench/lib/workbench/context';
import { AppScope } from './app-scope';
import type { ConsoleNavApp } from '@/lib/console/nav';

interface AppPanelProps {
  entry: ConsoleNavApp;
  pinned: boolean;
  onTogglePin: () => void;
  /** Unpinned panels are transient — they close once something is opened. */
  onDismiss: () => void;
  /**
   * Whether pinning is even a concept here. False in the mobile drawer, where
   * the panel IS the screen: a pinned panel would mean permanently covering the
   * work, so the control is not disabled, it is absent.
   */
  pinnable?: boolean;
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * The count of things waiting on a person in one screen, as a badge on its row.
 *
 * Its own component so the surface's `useBadgeCount` hook is called at a stable
 * position — a hook called inside a `.map()` would change order as the filter
 * changes the row set. Renders nothing at zero: a badge showing "0" trains
 * people to stop looking at badges.
 */
function NavBadge({ surface }: { surface: SurfaceDefinition }) {
  const useCount = surface.useBadgeCount;
  if (!useCount) return null;
  return <NavBadgeCount useCount={useCount} />;
}

function NavBadgeCount({ useCount }: { useCount: () => number | null | undefined }) {
  const count = useCount();
  if (!count || count <= 0) return null;
  return (
    <Badge color="warning" variant="soft" size="sm">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

/** React key for a nav row. The surface key alone stopped being unique the
 *  moment one surface could appear once per record type a business invented. */
function navRowKey(surface: SurfaceDefinition): string {
  const params = surface.defaultParams;
  if (!params) return surface.key;
  return `${surface.key}:${Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(',')}`;
}

function matches(surface: SurfaceDefinition, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  if (resolveTitle(surface, {}).toLowerCase().includes(needle)) return true;
  return (surface.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle));
}

export function AppPanel({
  entry,
  pinned,
  onTogglePin,
  onDismiss,
  pinnable = true,
}: AppPanelProps) {
  const { controller } = useWorkbench();
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const appId = entry.app.id;

  // Reset the filter when switching apps — a stale filter from the last app
  // reads as "this app is empty".
  useEffect(() => {
    setFilter('');
  }, [appId]);

  // An unpinned panel is a transient overlay, so Escape must dismiss it — the
  // same expectation any popover sets. A pinned panel is furniture and stays.
  useEffect(() => {
    if (pinned) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned, onDismiss]);

  /** Up/Down move between rows without leaving the keyboard, wrapping at both ends. */
  const onItemKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-nav-item]');
    if (!items?.length) return;

    event.preventDefault();
    const index = [...items].findIndex((item) => item === event.currentTarget);
    const next =
      event.key === 'ArrowDown'
        ? (items[index + 1] ?? items[0])
        : (items[index - 1] ?? items[items.length - 1]);
    next?.focus();
  };

  const openSurface = (
    surface: SurfaceDefinition,
    event: { shiftKey: boolean; altKey: boolean }
  ) => {
    // A row for a record type this business invented is the generic records
    // surface plus which type it is showing, so the params ride on the row.
    controller.open(surface.key, surface.defaultParams, { target: targetFor(event) });
    if (!pinned) onDismiss();
  };

  const sections = entry.sections
    .map((section) => ({
      ...section,
      surfaces: section.surfaces.filter((s) => matches(s, filter)),
    }))
    .filter((section) => section.surfaces.length > 0);

  const AppIcon = entry.icon;

  return (
    // Layout belongs to the shell: it renders this in normal flow (so the panel
    // PUSHES the panes right rather than covering them) inside a wrapper that
    // clips and animates its width open and shut. This component only ever fills
    // the box it is given.
    <AppScope app={appId} className="h-full shrink-0">
      {/* `collapsed={false}` is explicit and defensive: this is a full-width
          panel, never an icon strip, whatever collapsed state any ancestor
          SidebarProvider happens to be carrying. */}
      <Sidebar
        collapsed={false}
        color="module"
        aria-label={`${entry.label} navigation`}
        className="h-full bg-transparent"
      >
        <SidebarHeader>
          <SidebarHeaderBrand>
            {/* The SAME icon the rail shows for this app — the panel is the rail
                item opened up, so its header has to be recognisably that item.
                An abstract dot named nothing and forced the eye back to the rail
                to confirm what had been clicked. */}
            <AppIcon className="text-module size-5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate text-sm font-medium" title={entry.label}>
              {entry.label}
            </span>
          </SidebarHeaderBrand>
          {pinnable ? (
            <Tooltip content={pinned ? 'Unpin — hide after opening' : 'Pin — keep this open'}>
              <Button
                color="neutral"
                variant="ghost"
                size="xs"
                shape="square"
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin the navigation panel' : 'Pin the navigation panel'}
                onClick={onTogglePin}
              >
                {pinned ? (
                  <PinOff className="size-3.5" aria-hidden />
                ) : (
                  <Pin className="size-3.5" aria-hidden />
                )}
              </Button>
            </Tooltip>
          ) : null}
        </SidebarHeader>

        <SidebarContent ref={listRef}>
          {entry.count > 6 ? (
            <div className="px-2 pb-1">
              <SearchInput
                size="sm"
                value={filter}
                aria-label={`Filter ${entry.label}`}
                placeholder="Filter…"
                onValueChange={setFilter}
              />
            </div>
          ) : null}

          {sections.length === 0 ? (
            <Text className="px-3 py-6 text-center text-sm">
              {filter
                ? 'Nothing here matches that.'
                : `There is nothing in ${entry.label} you can open yet.`}
            </Text>
          ) : (
            sections.map((section, index) => (
              // The title is not unique across an app that fronts several
              // modules — two of them can each contribute a "Settings" — so the
              // key carries the position too.
              <SidebarGroup key={`${section.title ?? '_'}:${String(index)}`}>
                {section.title ? <SidebarGroupLabel>{section.title}</SidebarGroupLabel> : null}
                {section.surfaces.map((surface) => {
                  const label = resolveTitle(surface, {});
                  return (
                    // The `+` is a SIBLING of the row, not inside SidebarItem's
                    // `trailing` slot: SidebarItem renders a <button>, and a
                    // button inside a button is invalid HTML that React reports
                    // as a hydration error. `trailing` is for badges and
                    // chevrons — anything clickable has to sit outside.
                    <div key={navRowKey(surface)} className="group/row relative flex items-center">
                      <Tooltip
                        side="right"
                        content={`${label} — Shift-click to open alongside, Alt-click for a new window`}
                      >
                        <SidebarItem
                          data-nav-item
                          className="flex-1"
                          icon={<surface.icon className="size-4" aria-hidden />}
                          // `trailing` is for badges and chevrons —
                          // non-interactive, so the count can live inside the
                          // row's button.
                          trailing={<NavBadge surface={surface} />}
                          onKeyDown={onItemKeyDown}
                          onClick={(event) => {
                            openSurface(surface, event);
                          }}
                        >
                          {label}
                        </SidebarItem>
                      </Tooltip>

                      {surface.createSurface ? (
                        <Tooltip content={surface.createLabel ?? 'New'}>
                          <Button
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            shape="square"
                            aria-label={surface.createLabel ?? `New ${label}`}
                            // Revealed on row hover or its own focus, never
                            // display:none — it stays reachable by keyboard.
                            className="absolute right-2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                            onClick={(event) => {
                              const create = surface.createSurface;
                              if (!create) return;
                              controller.open(create, { id: 'new' }, { target: targetFor(event) });
                              if (!pinned) onDismiss();
                            }}
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </Button>
                        </Tooltip>
                      ) : null}
                    </div>
                  );
                })}
              </SidebarGroup>
            ))
          )}
        </SidebarContent>

        <SidebarFooter>
          <Text className="px-2 py-1 text-sm">Opens in a panel you can move anywhere.</Text>
        </SidebarFooter>
      </Sidebar>
    </AppScope>
  );
}
