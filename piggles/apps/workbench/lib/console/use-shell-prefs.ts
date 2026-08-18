'use client';

// The operator's remembered choices about the shell itself.
//
// Which app the panel is browsing and whether it is pinned, how wide the rail
// is, windows-or-tabs, and the zoom. Four different stores behind one hook,
// because to the person they are one thing: how their workspace is set up.
//
// EVERY read happens after mount. There is no localStorage on the server, so a
// render-time read makes the first client paint disagree with the HTML React was
// given and the tree is thrown away with a hydration error.
//
// Lifted out of components/console-shell.tsx, which was 555 lines of boot,
// preferences and chrome together.

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { loadNavState, saveNavState } from '@/lib/workbench/persistence';
import { readRailExpanded, writeRailExpanded } from '@/lib/rail-preference';
import { readWindowMode, writeWindowMode, type WindowMode } from '@/lib/window-mode';
import { DEFAULT_ZOOM, readZoom, writeZoom, type ZoomLevel } from '@/lib/window-zoom';

export interface ShellPrefs {
  browsing: string | null;
  setBrowsing: Dispatch<SetStateAction<string | null>>;
  /** The app the panel RENDERS, which lags `browsing` by design: on close it
   *  keeps the last one so the panel still has contents while its width animates
   *  shut, instead of blanking the instant you dismiss it. */
  panelApp: string;
  pinned: boolean;
  setPinned: Dispatch<SetStateAction<boolean>>;
  railExpanded: boolean;
  setRailExpanded: Dispatch<SetStateAction<boolean>>;
  /** Null until the stored value is read — "nobody has chosen" has to stay
   *  distinguishable from "chose tabs", or the dock tiles a returning windows
   *  user's layout and saves the result over their real one. */
  windowMode: WindowMode | null;
  onChangeWindowMode: (mode: WindowMode) => void;
  zoom: ZoomLevel;
  onChangeZoom: (zoom: ZoomLevel) => void;
}

export function useShellPrefs(): ShellPrefs {
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [panelApp, setPanelApp] = useState<string>('home');
  const [pinned, setPinned] = useState(false);
  // Labelled by DEFAULT, the opposite of sparx's icon rail: that audience learns
  // fifteen glyphs once and wants the pixels back; this one did not choose to be
  // in software today and should never decode an icon to find their invoices.
  // Overwritten below for anyone who HAS expressed a preference.
  const [railExpanded, setRailExpanded] = useState(true);
  const [windowMode, setWindowMode] = useState<WindowMode | null>(null);
  // Unlike the presentation, an unknown zoom is safe to guess at: 100% is what
  // the layout was saved at unless somebody says otherwise, and the dock ignores
  // the first value it is handed rather than re-placing anything.
  const [zoom, setZoom] = useState<ZoomLevel>(DEFAULT_ZOOM);

  useEffect(() => {
    const state = loadNavState();
    setPinned(state.pinned);
    // The rail's width comes from Piggles' OWN key, not the shared nav state —
    // the shared one defaults to collapsed and cannot express "never chosen".
    const storedRail = readRailExpanded();
    if (storedRail !== null) setRailExpanded(storedRail);
    // Only reopen the panel if it was PINNED. An unpinned panel is transient by
    // definition; restoring one greets somebody with an overlay to dismiss.
    if (state.pinned && state.module) setBrowsing(state.module);
  }, []);

  useEffect(() => {
    saveNavState({ module: browsing, pinned, railExpanded });
    writeRailExpanded(railExpanded);
  }, [browsing, pinned, railExpanded]);

  useEffect(() => {
    if (browsing) setPanelApp(browsing);
  }, [browsing]);

  // Both in ONE effect, and that matters: the dock is gated on the presentation
  // being known and treats the first zoom it is handed as the one its restored
  // layout was already saved at. Resolving the zoom a render later looks like
  // somebody just zoomed, and every window is scaled a second time. React
  // batches these into one commit. Do not split them.
  useEffect(() => {
    setWindowMode(readWindowMode() ?? 'tabs');
    setZoom(readZoom());
  }, []);

  // The shell owns the CHOICE and nothing else. Acting on it — photographing the
  // arrangement being left, restoring the one returned to — needs the dockview
  // api, the controller and the site key, so it lives in lib/dock/console-dock.tsx
  // and reacts to this prop.
  const onChangeWindowMode = useCallback((next: WindowMode) => {
    setWindowMode(next);
    writeWindowMode(next);
  }, []);

  const onChangeZoom = useCallback((next: ZoomLevel) => {
    setZoom(next);
    writeZoom(next);
  }, []);

  return {
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
  };
}
