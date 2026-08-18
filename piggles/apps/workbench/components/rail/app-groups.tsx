'use client';

// The apps on the rail, in colour families.
//
// No headings, no folding. A rail that changes height under you is a rail you
// have to re-read: the same fifteen apps sat in a different place depending on
// what was folded when you last left, which is the one thing the most-looked-at
// element in the product must never do.
//
// The families survive without the headings — they are already named by colour,
// and the gap between groups (`.sidebar-content`, @piggles/brand chrome.css) is
// what separated them anyway. A label over a family the colour states is an
// eyebrow (root CLAUDE.md RULE #2).
//
// Sections in the app PANEL still fold, and should: forty rows is a different
// problem from fifteen. See ../panel/panel-sections.tsx.

import { Icon } from '@piggles/ui';
import { SidebarGroup, SidebarItem, Tooltip } from '@wizeworks/silicaui-react';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { AppScope } from '../app-scope';
import { appWaiting, WaitingBadge } from './waiting';
import type { useAttention } from '@/lib/console/home-data';
import type { ConsoleNavApp } from '@/lib/console/nav';

interface AppGroupsProps {
  nav: ConsoleNavApp[];
  browsing: string | null;
  expanded: boolean;
  attention: ReturnType<typeof useAttention>;
  onBrowse: (appId: string) => void;
}

export function AppGroups({ nav, browsing, expanded, attention, onBrowse }: AppGroupsProps) {
  // Group ORDER comes from @piggles/brand, not from first appearance, so
  // reordering the registry cannot silently reshuffle the rail's families.
  const sections = PIGGLES_GROUPS.map((group) => ({
    group,
    apps: nav.filter((entry) => entry.group === group),
  })).filter((section) => section.apps.length > 0);

  const row = (entry: ConsoleNavApp) => (
    <AppScope key={entry.app.id} app={entry.app.id}>
      <Tooltip content={entry.app.purpose} side="right">
        <SidebarItem
          data-tour={`app-${entry.app.id}`}
          icon={<Icon glyph={entry.icon} className="text-module size-5" aria-hidden />}
          aria-label={entry.label}
          active={browsing === entry.app.id}
          // `aria-current` marks what is being BROWSED. Not aria-pressed: this is
          // a navigation position, not a toggle.
          aria-current={browsing === entry.app.id ? 'true' : undefined}
          onClick={() => {
            onBrowse(entry.app.id);
          }}
          trailing={<WaitingBadge count={appWaiting(entry, attention)} />}
        >
          {entry.label}
        </SidebarItem>
      </Tooltip>
    </AppScope>
  );

  // Collapsed: one flat column. At 60px there are no labels to band, so the
  // family gaps would read as arbitrary holes.
  if (!expanded) {
    return <SidebarGroup>{sections.flatMap((section) => section.apps).map(row)}</SidebarGroup>;
  }

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.group}>{section.apps.map(row)}</SidebarGroup>
      ))}
    </>
  );
}

export type { PigglesGroup };
