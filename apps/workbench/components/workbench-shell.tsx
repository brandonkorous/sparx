'use client';

// The shell — the only chrome the workbench has.
//
// A top toolbar (identity, search, the person) and a thin module rail; nothing
// else. There is no breadcrumb and no sidebar tree, because in this app neither
// can be right: breadcrumbs describe where you are, and here you are in several
// places at once. Orientation comes from the panes themselves and their tabs.
// Every pixel the chrome doesn't take is a pixel the operator's actual work does.
//
// The shell also owns BOOT: the dock cannot mount until the active site is
// known, because layouts are per-site (an invoice pane from Site A must never
// be restored under Site B). One token fetch answers it, and the sites list
// canonicalizes "no cookie yet" to the primary site so the layout key is stable
// across the first visit and every later one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SidebarProvider } from '@wizeworks/silicaui-react';
import { mintWindowId, openBus, type BusMessage } from '../lib/bus';
import { applyThemeToDocument, readTheme, THEME_STORAGE_KEY, type Theme } from '../lib/theme';
import { useActiveSiteId, useSites } from '../lib/api/shell-data';
import { WorkbenchProvider } from '../lib/workbench/context';
import { loadNavState, saveNavState } from '../lib/workbench/persistence';
import { Dock } from '../lib/dock/dock';
import { useIsCompact } from '../lib/use-compact';
import { MobileShell } from './mobile-shell';
import { Rail } from './rail';
import { StatusBar } from './status-bar';
import { Toolbar } from './toolbar';
import { Launcher } from './launcher';
import { ModulePanel } from './module-panel';
import { UpdateNotifier } from './update-notifier';
import { FeedbackProvider } from './feedback/provider';
import type { WorkbenchModule } from './module-scope';
// Registers every surface. Must be imported before the dock mounts, since a
// restored layout resolves surface keys synchronously while deserializing.
import '../lib/surfaces/catalog';

export function WorkbenchShell({ userName, userEmail }: { userName: string; userEmail: string }) {
  // Minted once per window. A popout gets its own id from the popout bootstrap.
  const windowIdRef = useRef<string | null>(null);
  windowIdRef.current ??= mintWindowId();
  const windowId = windowIdRef.current;

  const [theme, setTheme] = useState<Theme>('light');
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [browsing, setBrowsing] = useState<WorkbenchModule | null>(null);
  // The module the panel RENDERS, which lags `browsing` by design: on close it
  // keeps the last one so the panel still has contents while its width
  // animates shut. Without it the panel blanks the instant you dismiss it and
  // the close reads as a glitch rather than a movement.
  const [panelModule, setPanelModule] = useState<WorkbenchModule>('platform');
  const [pinned, setPinned] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const postRef = useRef<((message: BusMessage) => void) | null>(null);
  const isCompact = useIsCompact();

  // ── Boot: resolve the site the whole window operates under ───────────────
  const { data: tokenState } = useActiveSiteId();
  const { data: sites, isError: sitesFailed } = useSites();

  // The cookie names a site, or nothing. Nothing means api-rest scopes to the
  // primary property, so the primary's id IS the honest key for that state —
  // using it keeps the layout in one slot whether or not the cookie exists yet.
  const siteKey = useMemo(() => {
    if (tokenState === undefined) return null; // still booting
    if (tokenState.propertyId) return tokenState.propertyId;
    if (sites) return sites.find((site) => site.isPrimary)?.id ?? sites[0]?.id ?? 'default';
    return sitesFailed ? 'default' : null; // sites still loading (or unreachable)
  }, [tokenState, sites, sitesFailed]);

  // The site a feedback submission is about. Resolved here rather than inside
  // the feedback provider so it rides the same sites query the toolbar already
  // holds, instead of a second fetch for one name.
  const activeSite = useMemo(() => {
    const site = siteKey ? sites?.find((candidate) => candidate.id === siteKey) : undefined;
    return site ? { id: site.id, name: site.name } : null;
  }, [sites, siteKey]);

  // Restore nav state after mount, not during render — localStorage isn't
  // available on the server and reading it in render would break hydration.
  useEffect(() => {
    const state = loadNavState();
    setPinned(state.pinned);
    setRailExpanded(state.railExpanded);
    // Only reopen the panel automatically if it was pinned. An unpinned panel is
    // transient by definition; restoring one would greet the operator with an
    // overlay they have to dismiss before they can work.
    if (state.pinned && state.module) setBrowsing(state.module as WorkbenchModule);
  }, []);

  useEffect(() => {
    saveNavState({ module: browsing, pinned, railExpanded });
  }, [browsing, pinned, railExpanded]);

  useEffect(() => {
    if (browsing) setPanelModule(browsing);
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

  // Note: ⌘K/Ctrl+K is bound by <CommandPalette> itself (its `hotkey` prop
  // defaults on). Binding it here too would toggle twice per press and the
  // palette would never open.

  const openLauncher = useCallback(() => {
    setLauncherOpen(true);
  }, []);

  // Below 64rem the dock is not cramped, it is pointless — so the whole
  // presentation swaps rather than the layout shrinking. Everything below this
  // line is shared: same controller, same registry, same surfaces. Only the
  // PaneHost differs, which is the entire reason full mobile parity was
  // affordable at all. See lib/workbench/pane-host.ts.
  if (isCompact) {
    return (
      <WorkbenchProvider windowId={windowId} role="main">
        <FeedbackProvider theme={theme} activeSite={activeSite}>
          <MobileShell
            userName={userName}
            userEmail={userEmail}
            theme={theme}
            siteKey={siteKey}
            navOpen={navOpen}
            onNavOpenChange={setNavOpen}
            onToggleTheme={toggleTheme}
            onOpenLauncher={openLauncher}
          />
          <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
          {/* Inside the provider: the notifier asks the controller what would be
              lost before it offers to reload. */}
          <UpdateNotifier />
        </FeedbackProvider>
      </WorkbenchProvider>
    );
  }

  return (
    <WorkbenchProvider windowId={windowId} role="main">
      <FeedbackProvider theme={theme} activeSite={activeSite}>
        <div className="bg-base-300 flex h-dvh w-full flex-col overflow-hidden">
          {siteKey ? (
            <Toolbar
              userName={userName}
              userEmail={userEmail}
              theme={theme}
              siteKey={siteKey}
              onToggleTheme={toggleTheme}
              onOpenLauncher={openLauncher}
            />
          ) : (
            // Boot takes one same-origin fetch — a quiet strip beats a flash of
            // toolbar with no workspace name popping in a beat later.
            <div className="border-base-300 h-12 shrink-0 border-b" aria-hidden />
          )}

          <div className="relative flex min-h-0 flex-1">
            <SidebarProvider
              collapsed={!railExpanded}
              onCollapsedChange={(collapsed) => {
                setRailExpanded(!collapsed);
              }}
            >
              <div className={`bg-base-200 relative z-10 flex rounded-r-lg p-1`}>
                <Rail
                  browsing={browsing}
                  siteKey={siteKey ?? 'default'}
                  expanded={railExpanded}
                  onBrowse={(module) => {
                    // Clicking the module you're already browsing closes the
                    // panel — the same toggle every icon rail teaches.
                    setBrowsing((current) => (current === module ? null : module));
                  }}
                />
              </div>
            </SidebarProvider>

            {/* The module panel sits in NORMAL FLOW, so opening it pushes the
              panes right exactly as expanding the rail does — it never covers
              the work. (No overlay means no stacking context and no shadow:
              sparx separates surfaces with real edges and color, never a
              drop shadow.)

              This wrapper owns the open/close animation, not the panel: it
              clips to a width that transitions 0 ⇄ 16rem on the same 200ms
              ease the silica Sidebar uses, so the panel appears to grow out of
              the rail's edge instead of snapping the whole layout sideways.
              The panel therefore stays MOUNTED while closed (a width of zero,
              fully clipped), which is what makes the close animate too — and
              why it must be `inert` when shut, or its links would still be
              reachable by keyboard from inside a zero-width box. */}
            <div
              inert={browsing === null}
              aria-hidden={browsing === null}
              className={`bg-base-200 shrink-0 overflow-hidden rounded-r-xl transition-[width] duration-200 ease-in-out motion-reduce:transition-none ${
                browsing ? 'w-64' : 'w-0'
              }`}
            >
              <ModulePanel
                // Holds the LAST browsed module so the panel keeps its
                // contents while animating shut rather than blanking.
                module={panelModule}
                pinned={pinned}
                onTogglePin={() => {
                  setPinned((value) => !value);
                }}
                onDismiss={() => {
                  setBrowsing(null);
                }}
              />
            </div>

            <main className="min-w-0 flex-1 p-1">
              {/* The dock waits for the site key — restoring Site A's layout and
                then discovering we're on Site B would strand entity panes. */}
              {siteKey ? <Dock siteKey={siteKey} /> : null}
            </main>
            <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
          </div>

          {/* The live signal strip — connection, activity, unsaved work, and the
            business pulse. Signals only; identity stays in the toolbar. */}
          <StatusBar />

          {/* Inside the provider: the notifier asks the controller what would be
            lost before it offers to reload. */}
          <UpdateNotifier />
        </div>
      </FeedbackProvider>
    </WorkbenchProvider>
  );
}
