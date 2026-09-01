'use client';

// The desktop presentation: top bar, rail, app panel, dock, status strip.
//
// Everything here is a prop. It holds no state of its own on purpose — the
// compact shell has to be swappable for it at any width, and two presentations
// each keeping their own copy of "which app is browsed" is how they drift.

import type { Dispatch, SetStateAction } from 'react';
import { HeaderNotice, type HeaderNoticeData } from '@piggles/ui';
import { LifecycleBand } from '@/components/lifecycle-band';
import { WorkbenchProvider } from '@/lib/workbench/context';
import { StudioSessionProvider } from '@/lib/studio/provider';
import { BackNavigation } from '@/lib/workbench/nav-history';
import { ConsoleDock } from '@/lib/dock/console-dock';
import { ChromeBoundary } from '@/components/chrome-boundary';
import { DeepLinkArrival } from '@/components/deep-link-arrival';
import { FeedbackProvider } from '@/components/feedback/provider';
import { Launcher } from '@/components/launcher';
import { PaneWaiting } from '@/components/pane-waiting';
import { RecentsRecorder } from '@/components/recents-recorder';
import { StatusBar } from '@/components/status-bar';
import { UpdateNotifier } from '@/components/update-notifier';
import { FirstRunGuide } from '@/lib/tour/first-run-guide';
import { AppGuideOffers } from '@/lib/tour/app-tour-offers';
import type { ThemeChoice, Theme } from '@/lib/theme';
import type { WindowMode } from '@/lib/window-mode';
import type { ZoomLevel } from '@/lib/window-zoom';
import type { ConsoleNavApp } from '@/lib/console/nav';
import type { ShortcutList } from '@/lib/console/shortcut-lists';
import { ChromeColumn } from './chrome-column';
import { SkipToWorkspace, WORKSPACE_ID } from './skip-to-workspace';
import { Topbar } from './topbar';

interface DesktopShellProps {
  /** What WizeWorks is announcing on this surface, or null. Marketing notices
   *  are not written for the console, so this is planned work, an outage, or a
   *  change landing tomorrow — the things somebody mid-task needs told. */
  notice: HeaderNoticeData | null;
  windowId: string;
  userName: string;
  userEmail: string;
  accountOrigin: string;
  themeChoice: ThemeChoice;
  theme: Theme;
  setThemeChoice: (choice: ThemeChoice) => void;
  siteKey: string | null;
  siteSlug: string | undefined;
  activeSite: { id: string; name: string } | null;
  nav: ConsoleNavApp[];
  browsing: string | null;
  setBrowsing: Dispatch<SetStateAction<string | null>>;
  panelEntry: ConsoleNavApp | undefined;
  /** Set when the panel is showing one of the person's own lists instead. */
  panelList: ShortcutList | null;
  pinned: boolean;
  setPinned: Dispatch<SetStateAction<boolean>>;
  railExpanded: boolean;
  setRailExpanded: (expanded: boolean) => void;
  launcherOpen: boolean;
  setLauncherOpen: Dispatch<SetStateAction<boolean>>;
  openLauncher: () => void;
  windowMode: WindowMode | null;
  onChangeWindowMode: (mode: WindowMode) => void;
  zoom: ZoomLevel;
  onChangeZoom: (zoom: ZoomLevel) => void;
}

export function DesktopShell({
  notice,
  windowId,
  userName,
  userEmail,
  accountOrigin,
  themeChoice,
  theme,
  setThemeChoice,
  siteKey,
  siteSlug,
  activeSite,
  nav,
  browsing,
  setBrowsing,
  panelEntry,
  panelList,
  pinned,
  setPinned,
  railExpanded,
  setRailExpanded,
  launcherOpen,
  setLauncherOpen,
  openLauncher,
  windowMode,
  onChangeWindowMode,
  zoom,
  onChangeZoom,
}: DesktopShellProps) {
  return (
    <WorkbenchProvider windowId={windowId} role="main">
      <FeedbackProvider theme={theme} activeSite={activeSite}>
        <StudioSessionProvider>
          <div className="bg-base-300 flex h-dvh w-full flex-col overflow-hidden">
            <SkipToWorkspace />

            {/* ABOVE the top bar, inside the h-dvh column — so the bar takes its
                own height off the shell rather than pushing the dock below the
                fold. It renders nothing when there is nothing to say, which is
                most of the time, and the layout is identical in that case. */}
            <HeaderNotice notice={notice} />

            {/* The same slot, for the account's own state. Here rather than in
                the rail because the rail collapses and this must not: a site
                about to go offline cannot be behind a control the person may
                have used for screen space. Silent while the rail's card is
                showing the calm version of it. */}
            <LifecycleBand accountOrigin={accountOrigin} railCardVisible={railExpanded} />

            {/* Every chrome region is crash-isolated from the panels and from
              each other — the panels hold the unsaved work. */}
            <ChromeBoundary
              region="topbar"
              whatStopped="Search and your account menu have stopped working."
            >
              {/* Renders IMMEDIATELY, before the site key resolves: a bar that
                fills in its name a beat later reads as loading, an absent one as
                broken. */}
              <Topbar
                userName={userName}
                userEmail={userEmail}
                themeChoice={themeChoice}
                theme={theme}
                siteKey={siteKey ?? 'default'}
                accountOrigin={accountOrigin}
                windowMode={windowMode ?? 'tabs'}
                onChangeWindowMode={onChangeWindowMode}
                onSetTheme={setThemeChoice}
                onOpenLauncher={openLauncher}
              />
            </ChromeBoundary>

            <div className="relative flex min-h-0 flex-1">
              <ChromeColumn
                nav={nav}
                browsing={browsing}
                setBrowsing={setBrowsing}
                panelEntry={panelEntry}
                panelList={panelList}
                siteKey={siteKey}
                accountOrigin={accountOrigin}
                pinned={pinned}
                setPinned={setPinned}
                railExpanded={railExpanded}
                setRailExpanded={setRailExpanded}
              />

              <main
                id={WORKSPACE_ID}
                // `-1` so it can be focused by the skip control without joining
                // the tab order itself, which would put a stop in front of every
                // pane for no gain.
                tabIndex={-1}
                className="piggles-dock-host min-w-0 flex-1 p-1 focus:outline-none"
                data-guide="workspace"
              >
                {/* Waits for the site key AND the presentation: restoring Site
                  A's arrangement under Site B strands panels, and learning the
                  presentation second drags every off-to-one-side window back
                  against the edge. */}
                {siteKey && windowMode ? (
                  <ConsoleDock
                    siteKey={siteKey}
                    mode={windowMode}
                    zoom={zoom}
                    onChangeZoom={onChangeZoom}
                  />
                ) : (
                  <PaneWaiting label="Getting your things" />
                )}
              </main>

              {/* An overlay, so a crash renders NOTHING rather than an
                undismissable strip floating over the work. */}
              <ChromeBoundary region="launcher" whatStopped="Search has stopped working." silent>
                <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
              </ChromeBoundary>
            </div>

            {/* Signals only — identity stays in the top bar. */}
            <ChromeBoundary region="status-bar" whatStopped="Live updates have stopped showing.">
              <StatusBar />
            </ChromeBoundary>

            {/* Back walks the console's own navigation — launcher or panel
              closes first, then focus steps back through the panes. */}
            <BackNavigation
              launcher={launcherOpen}
              module={browsing}
              nav={false}
              siteSlug={siteSlug}
              onApply={(overlays) => {
                setLauncherOpen(overlays.launcher);
                setBrowsing(overlays.module ?? null);
              }}
            />

            {/* Opens whatever the address bar asked for. */}
            <DeepLinkArrival siteKey={siteKey} />

            {/* Inside the provider: the notifier asks the controller what would be
              lost before it offers to reload. */}
            <UpdateNotifier />
            {/* Listens for controller visits and records them to /v1/me/recents. */}
            <RecentsRecorder />

            {/* Desktop only, and not as an oversight: the guide points at the
              rail, the panel and the strip, and the compact shell has none of
              the three. Nothing is recorded until it is answered. */}
            <FirstRunGuide enabled />
            <AppGuideOffers browsing={browsing} />
          </div>
        </StudioSessionProvider>
      </FeedbackProvider>
    </WorkbenchProvider>
  );
}
