'use client';

// The shell — the only chrome the console has.
//
// A top bar (which business, which site, who you are) and a thin app rail;
// nothing else. There is no breadcrumb and no sidebar tree, because in this app
// neither can be right: a breadcrumb describes where you are, and here you are
// in several places at once. Orientation comes from the panels themselves and
// their tabs. Every pixel the chrome does not take is a pixel the work does.
//
// The shell also owns BOOT: nothing can mount until the active site is known,
// because arrangements are per-site (an invoice panel from Site A must never be
// restored under Site B). The server reads the active-site cookie and hands it
// down as `initialSiteKey`, so a returning person's workspace mounts on the
// first paint with no token round trip; only a genuine first visit falls back to
// the token fetch, which canonicalises "no cookie yet" to the primary site so
// the key is stable ever after.
//
// ── WHAT IS PIGGLES' HERE AND WHAT IS THE PLATFORM'S ────────────────────────
//
// Piggles owns the CHROME — this file, the top bar, the app rail, the app panel,
// the theme, the vocabulary, the first run. Everything it wraps is the shared
// workbench, mounted and never forked (piggles/CLAUDE.md RULE #0): the dock, the
// controller, the deep-link resolver, the launcher, the status strip, the update
// notifier. That split is the whole architecture — the parts that make this a
// different PRODUCT are here, and the parts that make it the same PLATFORM come
// from above.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SidebarProvider } from '@wizeworks/silicaui-react';
import { mintWindowId, openBus, type BusMessage } from '@workbench/lib/bus';
import { useActiveSiteId, useSites } from '@workbench/lib/api/shell-data';
import { WorkbenchProvider } from '@workbench/lib/workbench/context';
import { BackNavigation } from '@workbench/lib/workbench/nav-history';
import { readDeepLink, tidyLegacyParams } from '@workbench/lib/workbench/deep-link';
import { loadNavState, saveNavState } from '@workbench/lib/workbench/persistence';
import { Dock } from '@workbench/lib/dock/dock';
import { useIsCompact } from '@workbench/lib/use-compact';
import { ChromeBoundary } from '@workbench/components/chrome-boundary';
import { DeepLinkArrival } from '@workbench/components/deep-link-arrival';
import { FeedbackProvider } from '@workbench/components/feedback/provider';
import { Launcher } from '@workbench/components/launcher';
import { PaneWaiting } from '@workbench/components/pane-waiting';
import { RecentsRecorder } from '@workbench/components/recents-recorder';
import { StatusBar } from '@workbench/components/status-bar';
import { UpdateNotifier } from '@workbench/components/update-notifier';
// Registers every surface. MUST be imported before the dock mounts, since a
// restored arrangement resolves surface keys synchronously while deserializing.
import '@workbench/lib/surfaces/catalog';
import { applyThemeToDocument, readTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';
import { useConsoleNav, useUnclaimedModules } from '@/lib/console/nav';
import { AppPanel } from './app-panel';
import { AppRail } from './app-rail';
import { CompactConsole } from './compact-console';
import { Topbar } from './topbar';

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
  // Minted once per window. A popout gets its own id from the popout bootstrap.
  const windowIdRef = useRef<string | null>(null);
  windowIdRef.current ??= mintWindowId();
  const windowId = windowIdRef.current;

  const [theme, setTheme] = useState<Theme>('light');
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [browsing, setBrowsing] = useState<string | null>(null);
  // The app the panel RENDERS, which lags `browsing` by design: on close it
  // keeps the last one so the panel still has contents while its width animates
  // shut. Without it the panel blanks the instant you dismiss it and the close
  // reads as a glitch rather than a movement.
  const [panelApp, setPanelApp] = useState<string>('home');
  const [pinned, setPinned] = useState(false);
  // Labelled by DEFAULT, which is the opposite of sparx's icon rail.
  //
  // sparx's audience learns fifteen glyphs once and then wants the pixels back;
  // Piggles' audience did not choose to be in software today and should never
  // have to decode an icon to find their invoices. The rail still collapses —
  // the control is in its footer and the choice persists — but somebody who has
  // never expressed a preference gets words.
  //
  // `loadNavState` overwrites this after mount for anyone who HAS expressed one,
  // so this only decides the first visit.
  const [railExpanded, setRailExpanded] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const postRef = useRef<((message: BusMessage) => void) | null>(null);
  const isCompact = useIsCompact();

  const nav = useConsoleNav();
  const unclaimed = useUnclaimedModules();

  // Capture the address this page load arrived with, HERE, in the outermost
  // render — before anything downstream can rewrite it. The history bridge
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

  // ── Boot: resolve the site the whole window operates under ───────────────
  const { data: tokenState } = useActiveSiteId();
  const { data: sites, isError: sitesFailed } = useSites();

  // The cookie names a site, or nothing. Nothing means api-rest scopes to the
  // primary site, so the primary's id IS the honest key for that state — using
  // it keeps the arrangement in one slot whether or not the cookie exists yet.
  const siteKey = useMemo(() => {
    // The server already read the cookie (initialSiteKey); /api/token forwards
    // the IDENTICAL cookie as propertyId, so the two are equal whenever both are
    // present — trusting the server value first means the boot key is known on
    // the first render for everyone returning, with nothing to flip once the
    // token fetch confirms it.
    const cookieSite = tokenState?.propertyId ?? initialSiteKey;
    if (cookieSite) return cookieSite;
    if (tokenState === undefined) return null; // still booting, and no cookie hint
    if (sites) return sites.find((site) => site.isPrimary)?.id ?? sites[0]?.id ?? 'default';
    return sitesFailed ? 'default' : null; // sites still loading (or unreachable)
  }, [tokenState, sites, sitesFailed, initialSiteKey]);

  // The site a feedback submission is about. Resolved here rather than inside
  // the feedback provider so it rides the same sites query the top bar already
  // holds, instead of a second fetch for one name.
  const activeSite = useMemo(() => {
    const site = siteKey ? sites?.find((candidate) => candidate.id === siteKey) : undefined;
    return site ? { id: site.id, name: site.name } : null;
  }, [sites, siteKey]);

  // The slug every address is stamped with. Slug rather than id because a link
  // is written to be read — `?site=savory-donuts` says which business this is
  // about, and a uuid says nothing.
  const siteSlug = useMemo(() => {
    if (!siteKey) return undefined;
    return sites?.find((candidate) => candidate.id === siteKey)?.slug;
  }, [sites, siteKey]);

  // Restore nav state after mount, not during render — localStorage is not
  // available on the server and reading it in render would break hydration.
  useEffect(() => {
    const state = loadNavState();
    setPinned(state.pinned);
    setRailExpanded(state.railExpanded);
    // Only reopen the panel automatically if it was pinned. An unpinned panel is
    // transient by definition; restoring one would greet somebody with an
    // overlay they have to dismiss before they can work.
    if (state.pinned && state.module) setBrowsing(state.module);
  }, []);

  useEffect(() => {
    saveNavState({ module: browsing, pinned, railExpanded });
  }, [browsing, pinned, railExpanded]);

  useEffect(() => {
    if (browsing) setPanelApp(browsing);
  }, [browsing]);

  // Read the persisted theme after mount rather than during render — the
  // pre-paint script has already applied it to <html>, so this only syncs React
  // state and never causes a flash.
  useEffect(() => {
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    const bus = openBus((message) => {
      if (message.type === 'theme.changed') {
        setTheme(message.theme);
        applyThemeToDocument(document, message.theme);
      }
    });
    postRef.current = bus.post;
    bus.post({ type: 'window.hello', id: windowId, role: 'main' });

    const onUnload = () => {
      bus.post({ type: 'window.bye', id: windowId });
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      window.removeEventListener('pagehide', onUnload);
      bus.close();
      postRef.current = null;
    };
  }, [windowId]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light';
      applyThemeToDocument(document, next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage blocked — the theme still applies for this session.
      }
      // Detached windows are separate documents; they repaint via the bus.
      postRef.current?.({ type: 'theme.changed', theme: next });
      return next;
    });
  }, []);

  const openLauncher = useCallback(() => {
    setLauncherOpen(true);
  }, []);

  // The app the panel shows. Falls back to the first app in the rail rather than
  // rendering an empty panel, which would look broken during the close
  // animation if a saved `browsing` named an app this person cannot reach.
  const panelEntry = nav.find((entry) => entry.app.id === panelApp) ?? nav[0];

  // Note: ⌘K/Ctrl+K is bound by the Launcher itself. Binding it here too would
  // toggle twice per press and the palette would never open.

  // Below 64rem the dock is not cramped, it is pointless — so the whole
  // presentation swaps rather than the layout shrinking. Everything below this
  // line is shared: same controller, same registry, same surfaces. Only the
  // pane host differs, which is the entire reason full mobile parity is
  // affordable at all.
  if (isCompact) {
    return (
      <WorkbenchProvider windowId={windowId} role="main">
        <FeedbackProvider theme={theme} activeSite={activeSite}>
          <CompactConsole
            nav={nav}
            userName={userName}
            userEmail={userEmail}
            theme={theme}
            siteKey={siteKey}
            accountOrigin={accountOrigin}
            navOpen={navOpen}
            onNavOpenChange={setNavOpen}
            onToggleTheme={toggleTheme}
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
            nav={navOpen}
            siteSlug={siteSlug}
            onApply={(overlays) => {
              setLauncherOpen(overlays.launcher);
              setNavOpen(overlays.nav);
            }}
          />
          {/* Opens whatever the address bar asked for, once the stack is up.
              Identical on both shells — a link has to work the same on a phone. */}
          <DeepLinkArrival siteKey={siteKey} />
          {/* Inside the provider: the notifier asks the controller what would be
              lost before it offers to reload. */}
          <UpdateNotifier />
          <RecentsRecorder />
        </FeedbackProvider>
      </WorkbenchProvider>
    );
  }

  return (
    <WorkbenchProvider windowId={windowId} role="main">
      <FeedbackProvider theme={theme} activeSite={activeSite}>
        <div className="bg-base-300 flex h-dvh w-full flex-col overflow-hidden">
          {/* Every chrome region is crash-isolated from the panels and from each
              other. The panels hold the unsaved work; nothing up here is allowed
              to take that down. */}
          <ChromeBoundary
            region="topbar"
            whatStopped="Search and your account menu have stopped working."
          >
            {/* The chrome renders IMMEDIATELY, even before the site key resolves
                — a present bar that fills in its business name a beat later
                reads as loading; an absent one reads as broken. */}
            <Topbar
              userName={userName}
              userEmail={userEmail}
              theme={theme}
              siteKey={siteKey ?? 'default'}
              accountOrigin={accountOrigin}
              onToggleTheme={toggleTheme}
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
              {/* `relative` anchors the rail's own absolutely-positioned bits
                  (active indicator, tooltips) — but NO positive z-index: one
                  here lifts the rail above body-portalled popovers, so the site
                  switcher's dropdown paints BEHIND it. The panel and dock are
                  static and sit below the rail regardless; the dropdown,
                  portalled later in the DOM at the same stacking level, wins. */}
              <div className="bg-base-200 relative flex rounded-r-lg p-1">
                {/* `compact`: collapsed, the rail is a 48px column with no room
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
                    onBrowse={(appId) => {
                      // Clicking the app you are already browsing closes the
                      // panel — the same toggle every icon rail teaches.
                      setBrowsing((current) => (current === appId ? null : appId));
                    }}
                  />
                </ChromeBoundary>
              </div>
            </SidebarProvider>

            {/* The app panel sits in NORMAL FLOW, so opening it pushes the
                panels right exactly as expanding the rail does — it never covers
                the work. (No overlay means no stacking context and no shadow.)

                This wrapper owns the open/close animation, not the panel: it
                clips to a width that transitions 0 ⇄ 16rem on the same 200ms
                ease the silica Sidebar uses, so the panel appears to grow out of
                the rail's edge instead of snapping the layout sideways. The
                panel therefore stays MOUNTED while closed (a width of zero,
                fully clipped), which is what makes the close animate too — and
                why it must be `inert` when shut, or its rows would still be
                reachable by keyboard from inside a zero-width box. */}
            <div
              inert={browsing === null}
              aria-hidden={browsing === null}
              className={`bg-base-200 shrink-0 overflow-hidden rounded-r-xl transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${
                browsing ? 'w-64' : 'w-0'
              }`}
            >
              <ChromeBoundary region="app-panel" whatStopped="This app's menu has stopped working.">
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

            <main className="min-w-0 flex-1 p-1">
              {/* The dock waits for the site key — restoring Site A's
                  arrangement and then discovering we are on Site B would strand
                  panels. With the cookie handed down at SSR this is resolved on
                  the first paint for everyone returning; only a genuine first
                  visit lands here, and it gets the brand's loading mark rather
                  than an empty void, so the shell reads as loading its work
                  rather than as broken chrome. */}
              {siteKey ? <Dock siteKey={siteKey} /> : <PaneWaiting label="Getting your things" />}
            </main>

            {/* The launcher is an overlay, so a crash in it renders NOTHING
                rather than a strip — a warning bar floating over the work with
                no way to dismiss it would be worse than the missing palette,
                which ⌘K simply stops opening. */}
            <ChromeBoundary region="launcher" whatStopped="Search has stopped working." silent>
              <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
            </ChromeBoundary>
          </div>

          {/* The live signal strip — connection, activity, unsaved work. Signals
              only; identity stays in the top bar. */}
          <ChromeBoundary region="status-bar" whatStopped="Live updates have stopped showing.">
            <StatusBar />
          </ChromeBoundary>

          {/* Teaches the browser Back button to walk the console's own
              navigation — an open launcher or app panel closes first, then focus
              steps back through the panels you were looking at — instead of
              walking straight out of the app. */}
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

          {/* Opens whatever the address bar asked for, once the dock is up and
              the site gate has answered. */}
          <DeepLinkArrival siteKey={siteKey} />

          {/* Inside the provider: the notifier asks the controller what would be
              lost before it offers to reload. */}
          <UpdateNotifier />
          {/* Listens for controller visits and records them to /v1/me/recents. */}
          <RecentsRecorder />
        </div>
      </FeedbackProvider>
    </WorkbenchProvider>
  );
}
