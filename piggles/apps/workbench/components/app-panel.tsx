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
// What it DOES now reflect is whether each individual row is open — a property
// of the row, not a navigation position. See lib/console/open-surfaces.ts for
// why that costs the browser none of its independence.
//
// Everything it lists is derived from the app registry crossed with the surface
// registry (lib/console/nav.ts), so a screen cannot exist without being
// reachable from here. Its structure — destinations first, then folding
// sections — lives in ./panel/panel-sections.tsx.

import { useEffect, useRef, useState } from 'react';
import {
  SearchInput,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  Text,
} from '@wizeworks/silicaui-react';
import { resolveTitle, surfaceKeywords, type SurfaceDefinition } from '@/lib/surfaces/registry';
import { useWorkbench } from '@/lib/workbench/context';
import { useAttention } from '@/lib/console/home-data';
import { useOpenSurfaces } from '@/lib/console/open-surfaces';
import type { ConsoleNavApp } from '@/lib/console/nav';
import { AppScope } from './app-scope';
import { PanelHeader } from './panel/panel-header';
import { PanelSections } from './panel/panel-sections';
import { targetFor } from './panel/nav-row';

/** Above this many rows the panel offers a search box. Folding handles LENGTH;
 *  search handles "I know its name and do not know which section it is in". */
const SEARCH_ABOVE = 12;

interface AppPanelProps {
  entry: ConsoleNavApp;
  pinned: boolean;
  onTogglePin: () => void;
  /** Unpinned panels are transient — they close once something is opened. */
  onDismiss: () => void;
  /**
   * Whether pinning is even a concept here. False in the mobile sheet, where the
   * panel IS the screen: a pinned panel would mean permanently covering the
   * work, so the control is not disabled, it is absent.
   */
  pinnable?: boolean;
  /**
   * `panel` takes the fixed 20rem the desktop shell clips it to. `fill` takes
   * whatever the container is, for mobile.
   *
   * Not a detail. On a 320px phone a panel insisting on 20rem overflows by 48px,
   * which is a sideways scrollbar on the primary navigation. The desktop case
   * genuinely does want the fixed width: its wrapper animates from `w-80` to
   * `w-0`, and a percentage panel would re-wrap every label on the way shut
   * instead of sliding out cleanly.
   */
  width?: 'panel' | 'fill';
}

function matches(surface: SurfaceDefinition, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  if (resolveTitle(surface, {}).toLowerCase().includes(needle)) return true;
  return surfaceKeywords(surface).some((keyword) => keyword.toLowerCase().includes(needle));
}

export function AppPanel({
  entry,
  pinned,
  onTogglePin,
  onDismiss,
  pinnable = true,
  width = 'panel',
}: AppPanelProps) {
  const { controller } = useWorkbench();
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const appId = entry.app.id;
  // Same query keys the rail and Home read — react-query dedupes them to one
  // request each, which is what makes the three levels physically unable to
  // disagree.
  const attention = useAttention();
  const opened = useOpenSurfaces();

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

  const createFrom = (
    surface: SurfaceDefinition,
    event: { shiftKey: boolean; altKey: boolean }
  ) => {
    const create = surface.createSurface;
    if (!create) return;
    controller.open(create, { id: 'new' }, { target: targetFor(event) });
    if (!pinned) onDismiss();
  };

  const sections = entry.sections
    .map((section) => ({
      ...section,
      surfaces: section.surfaces.filter((s) => matches(s, filter)),
    }))
    .filter((section) => section.surfaces.length > 0);

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
        // 20rem, matching the wrapper the shell clips this to. BOTH are needed:
        // the wrapper owns the open/close animation and therefore the CLIP
        // width, while silica's Sidebar sizes itself from its own `--sidebar-w`,
        // which defaults to 16rem. Widening only the wrapper left four rems of
        // dead space with the labels still truncating.
        className={`text-chrome-deep-content h-full bg-transparent ${
          width === 'fill' ? 'w-full [--sidebar-w:100%]' : '[--sidebar-w:20rem]'
        }`}
      >
        <PanelHeader
          appId={appId}
          label={entry.label}
          icon={entry.icon}
          pinned={pinned}
          pinnable={pinnable}
          onTogglePin={onTogglePin}
        />

        <SidebarContent ref={listRef}>
          {entry.count > SEARCH_ABOVE ? (
            <div className="px-2 pb-1">
              <SearchInput
                size="sm"
                value={filter}
                aria-label={`Search ${entry.label}`}
                // "Filter" is what the control DOES to a list. "Search" is what
                // the person is doing, and it is the word they already know.
                placeholder="Search…"
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
            <PanelSections
              appId={appId}
              sections={sections}
              attention={attention}
              opened={opened}
              searching={filter.length > 0}
              onOpen={openSurface}
              onCreate={createFrom}
              onKeyDown={onItemKeyDown}
            />
          )}
        </SidebarContent>

        <SidebarFooter>
          <Text className="px-2 py-1 text-sm">Opens in a panel you can move anywhere.</Text>
        </SidebarFooter>
      </Sidebar>
    </AppScope>
  );
}
