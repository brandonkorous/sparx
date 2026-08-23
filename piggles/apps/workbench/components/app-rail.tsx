'use client';

// The rail — the console's primary navigation, and the one screen element a
// person looks at every single day.
//
// Fifteen APPS, not twenty modules: Piggles sells one plan with everything in it
// (piggles/CLAUDE.md RULE #2), so the unit is the thing you are doing. Everything
// here is derived from the app registry crossed with the surface registry
// (lib/console/nav.ts), so an app cannot exist without being reachable.
//
// ── ORDER: YOURS, THEN THE PRODUCT ──────────────────────────────────────────
//
// Favourites lead, then Recent — ONE ROW EACH, at every rail width, browsing
// into the panel the same way an app does (./rail/shortcuts.tsx). Then every app,
// in color families that no longer fold (./rail/app-groups.tsx). Everything else
// is behind All apps in the footer.
//
// Nothing on this rail is a list of its own contents. Twenty-five rows in the
// element a person looks at every day is a rail nobody scans, so the rail holds
// names and the panel holds lists.
//
// Selecting an app BROWSES it — see ./app-panel.tsx. It never changes what is
// open: in a workbench there is no single "current" place to switch away from.

import { useState } from 'react';
import { faGrid2Plus, faLeft, faRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  Tooltip,
  useSidebar,
} from '@wizeworks/silicaui-react';
import { useShortcutSurfaces } from '@/lib/console/use-shortcut-surfaces';
import { useAttention } from '@/lib/console/home-data';
import { AllAppsDialog } from './all-apps-dialog';
import { AppScope } from './app-scope';
import { AppGroups } from './rail/app-groups';
import { CapacityNotice } from './rail/capacity-notice';
import { Favourites, Recent } from './rail/shortcuts';
import { LayoutsMenu } from './rail/layouts-menu';
import { PlanCard } from './rail/plan-card';
import { FAVOURITES_LIST, RECENT_LIST } from '@/lib/console/shortcut-lists';
import type { ConsoleNavApp } from '@/lib/console/nav';

interface AppRailProps {
  nav: ConsoleNavApp[];
  /** The app currently being browsed, or null when the panel is closed. */
  browsing: string | null;
  /** Storage key for the active site — workspace saves flow through it. */
  siteKey: string;
  /** Labels showing beside the icons. Owned by the shell so it persists. */
  expanded: boolean;
  /** Where the account app lives. The plan card's only link leaves for it. */
  accountOrigin: string;
  onBrowse: (appId: string) => void;
}

export function AppRail({
  nav,
  browsing,
  siteKey,
  expanded,
  accountOrigin,
  onBrowse,
}: AppRailProps) {
  // The shell's SidebarProvider, reached the same way SidebarTrigger reaches it.
  // Null outside a provider, which is why the call below is optional.
  const sidebar = useSidebar();

  // Read here for ONE decision: whether Recent has anything to name yet. The
  // rows themselves live in the panel, which reads the same hook — one
  // reachability gate, shared, so a surface Piggles does not have cannot get in
  // through either (lib/console/use-shortcut-surfaces.ts).
  const { recents: recentSurfaces } = useShortcutSurfaces();
  // Shares its queries with Home by query key, so the rail and Home can never
  // show two different numbers for the same thing.
  const attention = useAttention();

  const [allAppsOpen, setAllAppsOpen] = useState(false);

  return (
    // The OUTER scope drives the ACTIVE item's accent: `.sidebar-module` declares
    // it on the <aside>, and a custom property resolves where it is DECLARED, so
    // a per-item scope comes too late. Per-item scopes still drive each icon.
    <AppScope app={browsing ?? 'home'} className="contents">
      <Sidebar
        color="module"
        aria-label="Apps"
        // 3.75rem (60px) collapsed. Silica ships 4.5rem, a corridor around a
        // 20px glyph; 3rem was the correction and overshot — under the 56px this
        // pattern settles on everywhere, and under Piggles' own comfortable
        // density, in the one mode a returning person sits in all day.
        // Set through the component's own documented CSS variable via a Tailwind
        // arbitrary property; never an inline style.
        className="bg-chrome text-chrome-content rounded-field shrink-0 [--sidebar-w-collapsed:3.75rem]"
      >
        {/* Padding tracks the width, so the row keeps a real hit area. */}
        {/* ── ORDER: yours, then the apps ──────────────────────────────────
            What somebody actually opens every day is five screens, not fifteen
            apps, and those five used to sit BELOW fifteen rows they did not
            choose. Both of the person's lists lead, one row apiece; the apps are
            the whole product beneath them. Everything not on this rail is behind
            All apps in the footer. */}
        <SidebarContent className={expanded ? 'pt-2' : 'px-1.5 pt-2'}>
          <Favourites
            expanded={expanded}
            browsing={browsing === FAVOURITES_LIST}
            onBrowseList={() => {
              onBrowse(FAVOURITES_LIST);
            }}
          />

          <Recent
            surfaces={recentSurfaces}
            expanded={expanded}
            browsing={browsing === RECENT_LIST}
            onBrowseList={() => {
              onBrowse(RECENT_LIST);
            }}
          />

          {/* Counts come from the same five server queries Home reads, so the
              rail and Home can never disagree (react-query dedupes them to one
              request each). What they MEAN, and the rollup onto each group
              heading, lives in ./rail/waiting.tsx. */}
          <AppGroups
            nav={nav}
            browsing={browsing}
            expanded={expanded}
            attention={attention}
            onBrowse={onBrowse}
          />
        </SidebarContent>

        <SidebarFooter className={expanded ? undefined : 'px-1.5'}>
          {/* Only when the rail is showing words. Collapsed, a plan card would
              be an unreadable smudge; the same information is one click away in
              the account menu. */}
          {expanded ? <PlanCard accountOrigin={accountOrigin} /> : null}
          {/* Both render nothing while the account is healthy. Order matters:
              a lapsed trial outranks a full meter. */}
          {expanded ? <CapacityNotice accountOrigin={accountOrigin} /> : null}

          {/* Permanent, in the footer, never behind a "…". Every app is on every
              plan, and what makes that true rather than merely stated is whether
              somebody can SEE the ones they have not switched on. */}
          <Tooltip content="Everything else Piggles does" side="right" disabled={expanded}>
            <SidebarItem
              icon={<Icon glyph={faGrid2Plus} className="size-5" aria-hidden />}
              aria-label="All apps"
              onClick={() => {
                setAllAppsOpen(true);
              }}
            >
              All apps
            </SidebarItem>
          </Tooltip>

          <LayoutsMenu siteKey={siteKey} expanded={expanded} />

          {/* The collapse control is a SidebarItem, NOT a SidebarTrigger.
              SidebarTrigger is a fixed 2rem square icon button, so a text label
              inside it has nowhere to go and spills out of the rail. SidebarItem
              is the row primitive: it lays out icon + label, hides the label
              itself when collapsed, and carries the same hover/focus treatment as
              every other row — so this reads as part of the rail rather than a
              loose control bolted underneath. It drives the same SidebarProvider
              the shell owns, so the choice persists. */}
          {/* The tooltip is disabled while expanded, so it only ever appears on
              the collapsed rail — where the action is Expand, not Collapse. */}
          <Tooltip content="Expand the app rail" side="right" disabled={expanded}>
            <SidebarItem
              // The arrow points where the rail is going, so the control shows
              // its next state rather than its current one.
              icon={<Icon glyph={expanded ? faLeft : faRight} className="size-5" aria-hidden />}
              aria-label={expanded ? 'Collapse the app rail' : 'Expand the app rail'}
              aria-expanded={expanded}
              onClick={() => {
                sidebar?.toggle();
              }}
            >
              Collapse
            </SidebarItem>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>

      {/* Owned by the rail but OUTSIDE the menu — the menu closes when its item
          is clicked; the dialog opens as its own thing, silicaui end to end
          (window.prompt is not a form). */}
      <AllAppsDialog open={allAppsOpen} onOpenChange={setAllAppsOpen} />
    </AppScope>
  );
}
