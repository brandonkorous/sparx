'use client';

// The floating navigation column: the rail, and the panel that slides out of it.
//
// One object, not two regions — which is why it owns the rounding, the shadow
// and the ground both sit on, and why the panel inside it is transparent.

import type { Dispatch, SetStateAction } from 'react';
import { SidebarProvider } from '@wizeworks/silicaui-react';
import { ChromeBoundary } from '@/components/chrome-boundary';
import type { ConsoleNavApp } from '@/lib/console/nav';
import type { ShortcutList } from '@/lib/console/shortcut-lists';
import { AppPanel } from './app-panel';
import { AppRail } from './app-rail';
import { ShortcutPanelHost } from './panel/shortcut-panel-host';

interface ChromeColumnProps {
  nav: ConsoleNavApp[];
  browsing: string | null;
  setBrowsing: Dispatch<SetStateAction<string | null>>;
  panelEntry: ConsoleNavApp | undefined;
  panelList: ShortcutList | null;
  siteKey: string | null;
  accountOrigin: string;
  pinned: boolean;
  setPinned: Dispatch<SetStateAction<boolean>>;
  railExpanded: boolean;
  setRailExpanded: (expanded: boolean) => void;
}

export function ChromeColumn({
  nav,
  browsing,
  setBrowsing,
  panelEntry,
  panelList,
  siteKey,
  accountOrigin,
  pinned,
  setPinned,
  railExpanded,
  setRailExpanded,
}: ChromeColumnProps) {
  return (
    <>
      {/* ONE chrome column holding both the rail and the panel, so the
        rounding lives on the outer edge and stays put as the panel
        opens. Rounding the rail's own wrapper meant it had to be
        square-right whenever the panel was out and round again when it
        shut — a corner that changed shape mid-slide.

        It also paints the ground for both: the rail sits on it as its
        own lighter block, the panel is transparent and simply lets it
        through.

        FLOATING, not docked — the same object the compact shell's nav
        bar is (./mobile/nav-bar.tsx): held off every edge, rounded the
        whole way round, lifted on a shadow. One presentation is then
        recognisably the other's, and the elevation is Piggles' own
        device rather than sparx's hairline (piggles/DESIGN.md §4). */}
      <div
        data-chrome="column"
        className="bg-chrome-deep text-chrome-deep-content rounded-box relative m-2 flex p-1.5 shadow-lg"
      >
        <SidebarProvider
          collapsed={!railExpanded}
          onCollapsedChange={(collapsed) => {
            setRailExpanded(!collapsed);
          }}
        >
          {/* `relative` anchors the rail's own absolute bits — but NO
          positive z-index, or the rail lifts above body-portalled
          popovers and the site switcher's dropdown paints behind it. */}
          <div className="relative flex" data-guide="app-rail">
            {/* `compact`: collapsed, the rail is a 60px column with no room
            for a sentence, so the fallback is the icon and a tooltip. */}
            <ChromeBoundary
              region="app-rail"
              whatStopped="The menu down the side has stopped working."
              compact
            >
              <AppRail
                nav={nav}
                browsing={browsing}
                siteKey={siteKey ?? 'default'}
                expanded={railExpanded}
                accountOrigin={accountOrigin}
                onBrowse={(appId) => {
                  // Clicking the app you are already browsing closes the
                  // panel — the same toggle every icon rail teaches.
                  setBrowsing((current) => (current === appId ? null : appId));
                }}
              />
            </ChromeBoundary>
          </div>
        </SidebarProvider>

        {/* NORMAL FLOW, so opening it pushes the panes right exactly as
        expanding the rail does — it never covers the work.

        This wrapper owns the open/close animation, which is why the
        panel stays MOUNTED while shut (width zero, clipped) — and why it
        must be `inert` then, or its rows stay keyboard-reachable inside
        a zero-width box. */}
        <div
          data-guide="app-panel"
          inert={browsing === null}
          aria-hidden={browsing === null}
          // 20rem, not silica's 16: Piggles names screens by what you are
          // DOING, so labels run longer, and nav rows are 16px not 14. At
          // 18rem the longer names still ellipsised.
          className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${
            browsing ? 'w-80' : 'w-0'
          }`}
        >
          <ChromeBoundary region="app-panel" whatStopped="This app's menu has stopped working.">
            {panelList ? (
              // Same pin, same dismissal, same remembered choice as the app
              // panel — it is the same panel showing one of the person's own
              // lists instead of an app.
              <ShortcutPanelHost
                list={panelList}
                pinned={pinned}
                onTogglePin={() => {
                  setPinned((value) => !value);
                }}
                onDismiss={() => {
                  setBrowsing(null);
                }}
              />
            ) : panelEntry ? (
              <AppPanel
                // Holds the LAST browsed app so the panel keeps its contents
                // while animating shut rather than blanking.
                entry={panelEntry}
                pinned={pinned}
                onTogglePin={() => {
                  setPinned((value) => !value);
                }}
                onDismiss={() => {
                  setBrowsing(null);
                }}
              />
            ) : null}
          </ChromeBoundary>
        </div>
      </div>
    </>
  );
}
