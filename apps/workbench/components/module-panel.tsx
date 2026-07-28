'use client';

// The navigation panel — a BROWSER, not a mirror.
//
// This is the one place the workbench deliberately departs from the dashboard's
// shell. There, the contextual panel reflects the module you are *in*. Here you
// can have panes from five modules open at once, so there is no "in" to
// reflect: the panel shows the module you asked to BROWSE. Picking Selling in
// the rail means "show me what Selling has", never "go to Selling", and nothing
// about the panel changes when you focus a different pane.
//
// Everything it lists is derived from the surface registry (see lib/surfaces/nav),
// so a surface can never exist without being reachable from here.
//
// Built from silicaui's <Sidebar> primitives — SidebarGroup/GroupLabel for
// sections, SidebarItem for surfaces, its `trailing` slot for the quick-create
// `+`. An earlier version hand-rolled these rows as raw <button>s with their own
// hover classes, which is exactly the re-skinning the design rules ban.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Pin, PinOff, Plus } from 'lucide-react';
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
import { ModuleScope, type WorkbenchModule } from './module-scope';
import { buildNav } from '../lib/surfaces/nav';
import { resolveTitle, type OpenTarget, type SurfaceDefinition } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import { isTourableModule } from '../lib/tour/module-tours';
import { launchModuleTour } from '../lib/tour/module-tour-offers';

interface ModulePanelProps {
  module: WorkbenchModule;
  pinned: boolean;
  onTogglePin: () => void;
  /** Unpinned panels are transient — they close once something is opened. */
  onDismiss: () => void;
  /**
   * Whether pinning is even a concept here. False in the mobile drawer, where
   * the panel IS the screen: a pinned panel would mean permanently covering the
   * work, so the control isn't disabled, it's absent.
   */
  pinnable?: boolean;
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * The count of things waiting on a person in one surface, as a badge on its row.
 *
 * Its own component so the surface's `useBadgeCount` hook is called at a stable position
 * — a hook called inside a `.map()` would change order as the filter changes the row set.
 * Renders nothing at zero: a badge showing "0" trains people to stop looking at badges.
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

function matches(surface: SurfaceDefinition, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  if (resolveTitle(surface, {}).toLowerCase().includes(needle)) return true;
  return (surface.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle));
}

export function ModulePanel({
  module,
  pinned,
  onTogglePin,
  onDismiss,
  pinnable = true,
}: ModulePanelProps) {
  const { controller } = useWorkbench();
  const nav = useMemo(() => buildNav(), []);
  const entry = nav.find((candidate) => candidate.module === module);
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');

  // Reset the filter when switching modules — a stale filter from the last
  // module reads as "this module is empty".
  useEffect(() => {
    setFilter('');
  }, [module]);

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

  /** Up/Down move between surfaces without leaving the keyboard, wrapping at both ends. */
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

  const openSurface = (key: string, event: { shiftKey: boolean; altKey: boolean }) => {
    controller.open(key, undefined, { target: targetFor(event) });
    if (!pinned) onDismiss();
  };

  const sections = (entry?.sections ?? [])
    .map((section) => ({
      ...section,
      surfaces: section.surfaces.filter((s) => matches(s, filter)),
    }))
    .filter((section) => section.surfaces.length > 0);

  const label = entry?.label ?? module;
  // The SAME icon the rail shows for this module, from the same MODULE_ICONS
  // map — the panel is the rail item opened up, so its header has to be
  // recognisably that item. An abstract dot named nothing and forced the eye
  // back to the rail to confirm what had been clicked.
  const ModuleIcon = entry?.icon;

  return (
    // Layout belongs to the shell: it renders this in normal flow (so the
    // panel PUSHES the panes right rather than covering them) inside a
    // wrapper that clips and animates its width open and shut. This
    // component only ever fills the box it is given.
    <ModuleScope module={module} className="h-full shrink-0">
      {/* `collapsed={false}` is explicit and defensive: this is a full-width
          panel, never an icon strip, whatever collapsed state any ancestor
          SidebarProvider happens to be carrying. */}
      <Sidebar
        collapsed={false}
        color="module"
        aria-label={`${label} navigation`}
        className="h-full bg-transparent"
      >
        <SidebarHeader>
          <SidebarHeaderBrand>
            {ModuleIcon ? <ModuleIcon className="text-module size-5 shrink-0" aria-hidden /> : null}
            <span className="min-w-0 truncate text-sm font-medium" title={label}>
              {label}
            </span>
          </SidebarHeaderBrand>
          {/* The deep-tour replay, only where a tour exists. Its outcome is
              per-user (docs/132 §7), so this is always available — the first-open
              offer fires once, this walks it again any time. */}
          {isTourableModule(module) ? (
            <Tooltip content={`Take the ${label} tour`}>
              <Button
                color="neutral"
                variant="ghost"
                size="xs"
                shape="square"
                aria-label={`Take the ${label} tour`}
                onClick={() => {
                  launchModuleTour(module);
                }}
              >
                <Compass className="size-3.5" aria-hidden />
              </Button>
            </Tooltip>
          ) : null}
          {pinnable ? (
            <Tooltip content={pinned ? 'Unpin — hide after opening' : 'Pin — keep this open'}>
              <Button
                color="neutral"
                variant="ghost"
                size="xs"
                shape="square"
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin navigation panel' : 'Pin navigation panel'}
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
          {(entry?.count ?? 0) > 6 ? (
            <div className="px-2 pb-1">
              <SearchInput
                size="sm"
                value={filter}
                aria-label={`Filter ${label}`}
                placeholder="Filter…"
                onValueChange={setFilter}
              />
            </div>
          ) : null}

          {sections.length === 0 ? (
            <Text className="px-3 py-6 text-center text-sm">
              {filter
                ? 'Nothing here matches that.'
                : 'Nothing here yet. This part of sparx has no screens available to you.'}
            </Text>
          ) : (
            sections.map((section) => (
              <SidebarGroup key={section.title ?? '_'}>
                {section.title ? <SidebarGroupLabel>{section.title}</SidebarGroupLabel> : null}
                {section.surfaces.map((surface) => {
                  const label = resolveTitle(surface, {});
                  return (
                    // The `+` is a SIBLING of the row, not inside SidebarItem's
                    // `trailing` slot: SidebarItem renders a <button>, and a
                    // button inside a button is invalid HTML that React reports
                    // as a hydration error. `trailing` is for badges and
                    // chevrons — anything clickable has to sit outside.
                    <div key={surface.key} className="group/row relative flex items-center">
                      <Tooltip
                        side="right"
                        content={`${label} — Shift-click to open alongside, Alt-click for a new window`}
                      >
                        <SidebarItem
                          data-nav-item
                          className="flex-1"
                          icon={<surface.icon className="size-4" aria-hidden />}
                          // `trailing` is for badges and chevrons — non-interactive, so
                          // the count can live inside the row's button.
                          trailing={<NavBadge surface={surface} />}
                          onKeyDown={onItemKeyDown}
                          onClick={(event) => {
                            openSurface(surface.key, event);
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
                              controller.open(
                                surface.createSurface!,
                                { id: 'new' },
                                { target: targetFor(event) }
                              );
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
          <Text className="px-2 py-1 text-sm">Opens as a new panel you can move anywhere.</Text>
        </SidebarFooter>
      </Sidebar>
    </ModuleScope>
  );
}
