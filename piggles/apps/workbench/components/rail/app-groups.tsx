'use client';

// The apps on the rail, in color families.
//
// No headings, no folding. A rail that changes height under you is a rail you
// have to re-read: the same apps sat in a different place depending on
// what was folded when you last left, which is the one thing the most-looked-at
// element in the product must never do.
//
// The families survive without the headings — they are already named by color,
// and the gap between groups (`.sidebar-content`, @piggles/brand chrome.css) is
// what separated them anyway. A label over a family the color states is an
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

  const row = (entry: ConsoleNavApp) => {
    const waiting = appWaiting(entry, attention);
    return (
      <AppScope key={entry.app.id} app={entry.app.id}>
        <Tooltip content={entry.app.purpose} side="right">
          <SidebarItem
            data-tour={`app-${entry.app.id}`}
            icon={<Icon glyph={entry.icon} className="text-module size-5" aria-hidden />}
            // ── THE COUNT HAS TO BE IN THE NAME ──────────────────────────────
            //
            // `aria-label` REPLACES a control's contents for a screen reader, it
            // does not add to them. So while this said only `entry.label`, the
            // row read "Invoices 9" on screen and announced "Invoices" — the
            // badge was drawn for one kind of person and withheld from another,
            // and it is the only thing on the rail that changes during the day.
            //
            // The label cannot simply be dropped: collapsed, the rail is 60px of
            // icons with no text to fall back on, which is what it is here for.
            // So the count joins it.
            //
            // The RAW number, not the badge's own `99+`. "125 waiting" is worth
            // more spoken than "99 plus waiting", and the shortening exists to
            // fit a pill, which is not a constraint speech has.
            aria-label={
              waiting === null ? entry.label : `${entry.label}, ${String(waiting)} waiting`
            }
            active={browsing === entry.app.id}
            // `aria-current` marks what is being BROWSED. Not aria-pressed: this is
            // a navigation position, not a toggle.
            aria-current={browsing === entry.app.id ? 'true' : undefined}
            onClick={() => {
              onBrowse(entry.app.id);
            }}
            trailing={<WaitingBadge count={waiting} />}
          >
            {entry.label}
          </SidebarItem>
        </Tooltip>
      </AppScope>
    );
  };

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
