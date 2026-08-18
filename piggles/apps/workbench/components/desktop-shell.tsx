'use client';

// The desktop presentation: top bar, rail, app panel, dock, status strip.
//
// Everything here is a prop. It holds no state of its own on purpose — the
// compact shell has to be swappable for it at any width, and two presentations
// each keeping their own copy of "which app is browsed" is how they drift.

import { SidebarProvider } from '@wizeworks/silicaui-react';
import type { Dispatch, SetStateAction } from 'react';
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
import { AppPanel } from './app-panel';
import { AppRail } from './app-rail';
import { Topbar } from './topbar';

interface DesktopShellProps {
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
              <SidebarProvider
                collapsed={!railExpanded}
                onCollapsedChange={(collapsed) => {
                  setRailExpanded(!collapsed);
                }}
              >
                {/* `relative` anchors the rail's own absolute bits — but NO
                  positive z-index, or the rail lifts above body-portalled
                  popovers and the site switcher's dropdown paints behind it. */}
                <div className="bg-base-200 relative flex rounded-r-lg p-1" data-guide="app-rail">
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
                className={`bg-base-200 shrink-0 overflow-hidden rounded-r-xl transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${
                  browsing ? 'w-80' : 'w-0'
                }`}
              >
                <ChromeBoundary
                  region="app-panel"
                  whatStopped="This app's menu has stopped working."
                >
                  {panelEntry ? (
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

              <main className="piggles-dock-host min-w-0 flex-1 p-1" data-guide="workspace">
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
