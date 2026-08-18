'use client';

// The shell — boot, preferences, and which presentation to render.
//
// It owns BOOT: nothing mounts until the active site is known, because
// arrangements are per-site (an invoice panel from Site A must never be restored
// under Site B). See lib/console/use-site-boot.ts.
//
// The chrome itself lives in ./desktop-shell.tsx and ./compact-console.tsx. What
// makes this a different PRODUCT is here and in those two; what makes it the
// same PLATFORM — the dock, the controller, the registry, the launcher — is
// mounted and never forked (piggles/CLAUDE.md RULE #0).

import { useCallback, useEffect, useRef, useState } from 'react';
import { mintWindowId, openBus } from '@/lib/bus';
import { readDeepLink, tidyLegacyParams } from '@/lib/workbench/deep-link';
import { useIsCompact } from '@/lib/use-compact';
// Order is load-bearing. The adapter first: surfaces read it at module scope,
// and an unconfigured one silently answers with sparx's name and mascot. Then
// the catalog, before the dock mounts — a restored arrangement resolves surface
// keys synchronously while deserializing.
import '@/lib/console/product';
import '@/lib/surfaces/catalog';
// Piggles' OWN surfaces, registered after the platform's so nothing shared can
// shadow them. Additions only — never a re-registration of a platform key.
import '@/lib/surfaces/piggles-catalog';
import { useConsoleTheme } from '@/lib/use-theme';
import { useGuideBrowseRequests } from '@/lib/tour/anchor';
import { useUnclaimedModules } from '@/lib/console/nav';
import { useRailNav } from '@/lib/console/apps';
import { useSiteBoot } from '@/lib/console/use-site-boot';
import { useShellPrefs } from '@/lib/console/use-shell-prefs';
import { isShortcutList } from '@/lib/console/shortcut-lists';
import { useModuleReconcile } from '@/lib/console/reconcile';
import { CompactShell } from './compact-shell';
import { DesktopShell } from './desktop-shell';
import type { NavTab } from './mobile/nav-bar';

export function ConsoleShell({
  userName,
  userEmail,
  initialSiteKey,
  arrivalAddress,
  accountOrigin,
}: {
  userName: string;
  userEmail: string;
  /** The active site read from the cookie server-side — the boot key when set,
   *  so the dock mounts without waiting on the token fetch. Null on a first
   *  visit, where boot falls back to the token + sites resolution. */
  initialSiteKey: string | null;
  /** The address the SERVER matched for this render — the one authority on what
   *  this page load is asking for. See app/console-entry.tsx. */
  arrivalAddress: string;
  /** Where the account app lives. Server-resolved and threaded down, because the
   *  variable that decides it is server-only. */
  accountOrigin: string;
}) {
  const windowIdRef = useRef<string | null>(null);
  windowIdRef.current ??= mintWindowId();
  const windowId = windowIdRef.current;

  // Owned end to end by the hook, in every window (lib/use-theme.ts).
  const { choice: themeChoice, theme, setChoice: setThemeChoice } = useConsoleTheme();
  const [launcherOpen, setLauncherOpen] = useState(false);
  // How this person has their workspace set up — what the panel is browsing,
  // the rail's width, windows-or-tabs, the zoom. See lib/console/use-shell-prefs.ts.
  const {
    browsing,
    setBrowsing,
    panelApp,
    pinned,
    setPinned,
    railExpanded,
    setRailExpanded,
    windowMode,
    onChangeWindowMode,
    zoom,
    onChangeZoom,
  } = useShellPrefs();

  // WHICH sheet the compact shell has up, not merely whether one is. ONE source:
  // the compact shell used to hold its own copy beside this and the two raced —
  // a tap opened a sheet and the sync effect shut it again.
  const [navTab, setNavTab] = useState<NavTab | null>(null);
  const isCompact = useIsCompact();

  // The rail, not the catalogue — All apps is where the rest stays visible.
  const nav = useRailNav();
  const unclaimed = useUnclaimedModules();
  // A module left off is a gap to close, not a choice to respect.
  useModuleReconcile();

  // Captured HERE, in the outermost render, before anything downstream can
  // rewrite it. The history bridge
  // starts replacing the bar with the focused panel's address as soon as the
  // arrangement restores, so a link read any later than this is a link already
  // overwritten. The read is PURE and idempotent, and no-ops on the server.
  readDeepLink(arrivalAddress);

  useEffect(() => {
    tidyLegacyParams();
  }, []);

  // A module the platform offers that no Piggles app claims is INVISIBLE: its
  // screens simply do not exist here, with no error and no gap anybody can see.
  // Reported in development, where the person who just added the module is the
  // one who can fix it. Never thrown — a missing rail entry must not take a
  // workspace down.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || unclaimed.length === 0) return;
    console.warn(
      `[piggles] These platform modules are not in any Piggles app, so nothing behind them is reachable: ${unclaimed.join(', ')}. Add them to APPS in @piggles/config.`
    );
  }, [unclaimed]);

  // Which site this window operates under. Everything arrangement-shaped waits
  // on it — see lib/console/use-site-boot.ts.
  const { siteKey, activeSite, siteSlug } = useSiteBoot(initialSiteKey);

  // A guide step about an app's panel needs that panel open. Which app the panel
  // shows is state that lives here, so the request arrives as an event rather
  // than by threading a setter down to the status strip for one caller.
  useGuideBrowseRequests(setBrowsing);

  useEffect(() => {
    // Presence only. Appearance travels on this same channel but is handled by
    // useConsoleTheme, which opens its own subscription — every window needs it,
    // including the popouts that never mount this shell.
    const bus = openBus(() => undefined);
    bus.post({ type: 'window.hello', id: windowId, role: 'main' });

    const onUnload = () => {
      bus.post({ type: 'window.bye', id: windowId });
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      window.removeEventListener('pagehide', onUnload);
      bus.close();
    };
  }, [windowId]);

  const openLauncher = useCallback(() => {
    setLauncherOpen(true);
  }, []);

  // What the panel shows: an app, or one of the person's own two lists. Both
  // ride `panelApp` rather than `browsing`, which lags it by design so the panel
  // keeps its contents while animating shut instead of blanking.
  //
  // Falls back to the first app in the rail rather than rendering an empty panel,
  // which would look broken during the close animation if a saved `browsing`
  // named an app this person cannot reach.
  const panelList = isShortcutList(panelApp) ? panelApp : null;
  const panelEntry = nav.find((entry) => entry.app.id === panelApp) ?? nav[0];

  // Note: ⌘K/Ctrl+K is bound by the Launcher itself. Binding it here too would
  // toggle twice per press and the palette would never open.

  // Below 64rem the dock is not cramped, it is pointless — so the whole
  // presentation swaps rather than the layout shrinking.
  if (isCompact) {
    return (
      <CompactShell
        windowId={windowId}
        userName={userName}
        userEmail={userEmail}
        accountOrigin={accountOrigin}
        themeChoice={themeChoice}
        theme={theme}
        setThemeChoice={setThemeChoice}
        siteKey={siteKey}
        siteSlug={siteSlug}
        activeSite={activeSite}
        nav={nav}
        navTab={navTab}
        setNavTab={setNavTab}
        launcherOpen={launcherOpen}
        setLauncherOpen={setLauncherOpen}
        openLauncher={openLauncher}
      />
    );
  }

  return (
    <DesktopShell
      windowId={windowId}
      userName={userName}
      userEmail={userEmail}
      accountOrigin={accountOrigin}
      themeChoice={themeChoice}
      theme={theme}
      setThemeChoice={setThemeChoice}
      siteKey={siteKey}
      siteSlug={siteSlug}
      activeSite={activeSite}
      nav={nav}
      browsing={browsing}
      setBrowsing={setBrowsing}
      panelEntry={panelEntry}
      panelList={panelList}
      pinned={pinned}
      setPinned={setPinned}
      railExpanded={railExpanded}
      setRailExpanded={setRailExpanded}
      launcherOpen={launcherOpen}
      setLauncherOpen={setLauncherOpen}
      openLauncher={openLauncher}
      windowMode={windowMode}
      onChangeWindowMode={onChangeWindowMode}
      zoom={zoom}
      onChangeZoom={onChangeZoom}
    />
  );
}
