'use client';

// The compact presentation, assembled. Sibling of ./desktop-shell.tsx and the
// same shape: everything is a prop, no state of its own.
//
// Everything here is SHARED with the desktop — same controller, same registry,
// same surfaces. Only the pane host differs, which is the entire reason full
// mobile parity is affordable at all.

import type { Dispatch, SetStateAction } from 'react';
import { WorkbenchProvider } from '@/lib/workbench/context';
import { StudioSessionProvider } from '@/lib/studio/provider';
import { BackNavigation } from '@/lib/workbench/nav-history';
import { ChromeBoundary } from '@/components/chrome-boundary';
import { DeepLinkArrival } from '@/components/deep-link-arrival';
import { FeedbackProvider } from '@/components/feedback/provider';
import { Launcher } from '@/components/launcher';
import { RecentsRecorder } from '@/components/recents-recorder';
import { UpdateNotifier } from '@/components/update-notifier';
import type { ThemeChoice, Theme } from '@/lib/theme';
import type { ConsoleNavApp } from '@/lib/console/nav';
import { CompactConsole } from './compact-console';
import type { NavTab } from './mobile/nav-bar';

interface CompactShellProps {
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
  navTab: NavTab | null;
  setNavTab: Dispatch<SetStateAction<NavTab | null>>;
  launcherOpen: boolean;
  setLauncherOpen: Dispatch<SetStateAction<boolean>>;
  openLauncher: () => void;
}

export function CompactShell({
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
  navTab,
  setNavTab,
  launcherOpen,
  setLauncherOpen,
  openLauncher,
}: CompactShellProps) {
  return (
    <WorkbenchProvider windowId={windowId} role="main">
      <FeedbackProvider theme={theme} activeSite={activeSite}>
        {/* ABOVE the pane host, in both presentations. A session held inside a
          pane would be one session per pane — two drafts of one document, which
          is the arrangement the per-document editor exists to replace. */}
        <StudioSessionProvider>
          <CompactConsole
            nav={nav}
            userName={userName}
            userEmail={userEmail}
            themeChoice={themeChoice}
            theme={theme}
            siteKey={siteKey}
            accountOrigin={accountOrigin}
            navTab={navTab}
            onNavTabChange={setNavTab}
            onSetTheme={setThemeChoice}
            onOpenLauncher={openLauncher}
          />
          <ChromeBoundary region="launcher" whatStopped="Search has stopped working." silent>
            <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
          </ChromeBoundary>
          {/* Teaches the browser Back button to walk the compact shell's own
          navigation — the drawer and launcher close first, then focus steps
          back through the stack — instead of leaving the app. */}
          <BackNavigation
            launcher={launcherOpen}
            module={null}
            nav={navTab !== null}
            siteSlug={siteSlug}
            onApply={(overlays) => {
              setLauncherOpen(overlays.launcher);
              // Back can only CLOSE a sheet; which one was up is still ours.
              if (!overlays.nav) setNavTab(null);
            }}
          />
          {/* Opens whatever the address bar asked for, once the stack is up.
          Identical on both shells — a link has to work the same on a phone. */}
          <DeepLinkArrival siteKey={siteKey} />
          {/* Inside the provider: the notifier asks the controller what would be
          lost before it offers to reload. */}
          <UpdateNotifier />
          <RecentsRecorder />
        </StudioSessionProvider>
      </FeedbackProvider>
    </WorkbenchProvider>
  );
}
