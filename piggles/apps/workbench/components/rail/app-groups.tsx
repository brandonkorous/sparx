'use client';

// The apps on the rail, in folding groups.
//
// ── WHY THESE FOLD NOW WHEN THEY DID NOT BEFORE ─────────────────────────────
//
// The rail used to be fifteen apps and nothing else, and a heading over them
// would have been a label explaining what the colors already said. Favourites
// and recent now sit ABOVE the apps, so the rail got longer, and folding is what
// pays for them.
//
// Two rules keep it from becoming the thing it was avoided for:
//   • a group holding ONE app renders bare — a heading over a single row is an
//     eyebrow (root CLAUDE.md RULE #2);
//   • the headings are named for what you do there, never the color key
//     (`web`, `run`) — see GROUP_TERMS in @piggles/config.
//
// ── THE HEADING IS A ROW, NOT A LABEL ───────────────────────────────────────
//
// It was a <button> inside SidebarGroupLabel, which made it a control silica had
// never sized: the label type is deliberately smaller than a row's, so the thing
// you click to reveal five apps read as finer print than the apps themselves.
// A SidebarItem is the row primitive — same type, same hit area, same hover and
// focus treatment — so the disclosure now matches what it discloses, and there
// is no hand-rolled control left here at all.
//
// A COLLAPSED rail has no room for headings, so it renders one flat column of
// icons: folding shortens a list you can read, and there is nothing to read at
// 48px.

import { faChevronDown } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { SidebarGroup, SidebarItem, Tooltip } from '@wizeworks/silicaui-react';
import { PIGGLES_GROUPS, type PigglesGroup } from '@piggles/brand';
import { groupTerm } from '@piggles/config';
import { isGroupFolded, setGroupFolded, useGroupChoices } from '@/lib/console/rail-groups';
import { AppScope } from '../app-scope';
import { appWaiting, groupWaiting, WaitingBadge } from './waiting';
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
  const [folded, setFolded] = useGroupChoices();

  // Group ORDER comes from @piggles/brand, not from first appearance, so
  // reordering the registry cannot silently reshuffle the rail's families.
  const sections = PIGGLES_GROUPS.map((group) => ({
    group,
    apps: nav.filter((entry) => entry.group === group),
  })).filter((section) => section.apps.length > 0);

  /** One app. `indented` sits it under a heading so it reads as a child of it. */
  const row = (entry: ConsoleNavApp, indented: boolean) => (
    <AppScope key={entry.app.id} app={entry.app.id} className={indented ? 'ps-3' : undefined}>
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

  // Collapsed: one flat column, every app, no headings and no folding.
  if (!expanded) {
    return (
      <SidebarGroup>
        {sections.flatMap((section) => section.apps).map((entry) => row(entry, false))}
      </SidebarGroup>
    );
  }

  return (
    <>
      {sections.map((section) => {
        const title = section.apps.length > 1 ? groupTerm(section.group) : undefined;
        if (!title) {
          return (
            <SidebarGroup key={section.group}>
              {section.apps.map((entry) => row(entry, false))}
            </SidebarGroup>
          );
        }

        const shut = isGroupFolded(section.group, folded);
        return (
          <SidebarGroup key={section.group}>
            <SidebarItem
              icon={
                <Icon
                  glyph={faChevronDown}
                  className={`size-4 transition-transform ${shut ? '-rotate-90' : ''}`}
                  aria-hidden
                />
              }
              aria-expanded={!shut}
              onClick={() => {
                setFolded(setGroupFolded(section.group, !shut));
              }}
              // Rolled up from the apps inside, folded or open. Folded because
              // you cannot see the rows; open because a total that disappears
              // when you expand is a different answer to the same question.
              trailing={<WaitingBadge count={groupWaiting(section.apps, attention)} />}
            >
              {title}
            </SidebarItem>
            {shut ? null : section.apps.map((entry) => row(entry, true))}
          </SidebarGroup>
        );
      })}
    </>
  );
}

export type { PigglesGroup };
