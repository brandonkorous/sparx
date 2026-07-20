'use client';

// Save lives in the pane toolbar, not in the tab body — and this file is how a
// tab hands its save up to it.
//
// ── Why the toolbar ──────────────────────────────────────────────────────
//
// Each of the six tabs writes to its own endpoints, so the first instinct was to
// put each tab's Save inside that tab, keeping the button's scope visually equal
// to what it writes. In practice that put the surface's primary action in the
// middle of the panel, floating in open space between a status callout and the
// first form card — anchored to nothing, and reading as ambiguous about which of
// the two it belonged to. The ambiguity it avoided (does toolbar Save commit all
// six tabs?) was hypothetical; the one it created was immediate.
//
// So Save sits in the toolbar where a primary action belongs, and SCOPE IS
// CARRIED BY THE DIRTY DOT instead of by placement. A dot on Pricing tells you
// Pricing has unsaved work while you are standing on Media — which placement was
// never going to communicate anyway. Same device the dock already uses on a pane
// tab, one level down.
//
// ── Why panels mount lazily and then stay mounted ────────────────────────
//
// A tab you have never opened cannot have unsaved changes. A tab you edited and
// then navigated away from very much can. If panels unmounted on tab switch, that
// second tab would lose its edits AND its dot at the same moment — the edit would
// be gone and nothing would say so. So a panel mounts the first time you visit it
// and stays mounted for the life of the pane. Never-visited tabs cost nothing,
// which is the whole reason lazy-then-keep works here rather than keepMounted.
//
// ── The contract a tab implements ────────────────────────────────────────
//
//   function ProductPricingTab({ product }: ProductTabProps) {
//     const [draft, setDraft] = useState(...);
//     const update = useUpdateSomething();
//     const dirty = draft !== initial;
//
//     useTabSave({
//       dirty,
//       saving: update.isPending,
//       save: async () => { await update.mutateAsync(draft); },
//     });
//
//     return <>…fields…</>;   // NO Save button. The toolbar renders it.
//   }
//
// Rules:
//   • A tab renders NO Save button of its own. Not a secondary one, not a sticky
//     one. There is exactly one Save on the surface and the toolbar owns it.
//   • `save` throws on failure. The toolbar catches it and reports; a tab that
//     swallows its own error makes the toolbar claim a write that did not happen.
//   • `save` must be safe to call when `dirty` is false (the toolbar disables the
//     button, but a keyboard shortcut can still reach it).
//   • Destructive or lifecycle actions are NOT saves and do not route through
//     here — they stay in the tab (or the toolbar) as their own controls with
//     their own confirms.

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** What a tab hands up. `save` rejects on failure — the toolbar reports it. */
export interface TabSaveRegistration {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

interface TabSaveRegistry {
  register: (tabValue: string, entryId: string, value: TabSaveRegistration) => void;
  unregister: (tabValue: string, entryId: string) => void;
}

const TabSaveContext = createContext<TabSaveRegistry | null>(null);

/** Which tab the registering component is inside. Set by the shell per panel, so
 *  a tab body never has to know or repeat its own tab key. */
const TabValueContext = createContext<string | null>(null);

export function TabValueProvider({ value, children }: { value: string; children: ReactNode }) {
  return <TabValueContext.Provider value={value}>{children}</TabValueContext.Provider>;
}

/**
 * Hand this tab's save up to the pane toolbar.
 *
 * Call it unconditionally at the top level of a tab body — it is a hook, so it
 * cannot sit behind an `if`. A tab with nothing to save simply does not call it,
 * and the toolbar hides Save while that tab is active.
 */
export function useTabSave(registration: TabSaveRegistration): void {
  const registry = useContext(TabSaveContext);
  const tabValue = useContext(TabValueContext);
  const entryId = useId();

  // The latest registration without re-registering on every keystroke: the shell
  // reads through this ref, so a changing `dirty` does not churn the registry.
  const latest = useRef(registration);
  latest.current = registration;

  useEffect(() => {
    if (!registry || !tabValue) return;
    const proxy: TabSaveRegistration = {
      get dirty() {
        return latest.current.dirty;
      },
      get saving() {
        return latest.current.saving;
      },
      save: () => latest.current.save(),
    };
    registry.register(tabValue, entryId, proxy);
    return () => registry.unregister(tabValue, entryId);
  }, [registry, tabValue, entryId]);

  // Re-render subscribers when the values behind the getters change, since a ref
  // mutation alone is invisible to React.
  const { dirty, saving } = registration;
  useEffect(() => {
    if (!registry || !tabValue) return;
    registry.register(tabValue, entryId, {
      get dirty() {
        return latest.current.dirty;
      },
      get saving() {
        return latest.current.saving;
      },
      save: () => latest.current.save(),
    });
  }, [registry, tabValue, entryId, dirty, saving]);
}

/* ── Shell side ─────────────────────────────────────────────────────────── */

export interface TabSaveState {
  /** Tab values with unsaved work — the shell renders a dot on each. */
  dirtyTabs: ReadonlySet<string>;
  /** The active tab's save, or null when this tab has nothing to save. */
  active: TabSaveRegistration | null;
  /** Any tab dirty at all — drives the pane-level leave guard. */
  anyDirty: boolean;
}

/**
 * Owns the registry for one product pane. The shell wraps its tabs in
 * `provider` and reads `state` to render the toolbar Save and the dirty dots.
 */
export function useTabSaveRegistry(activeTab: string): {
  provider: (children: ReactNode) => ReactNode;
  state: TabSaveState;
} {
  const [entries, setEntries] = useState<ReadonlyMap<string, TabSaveRegistration>>(new Map());

  const registry = useMemo<TabSaveRegistry>(
    () => ({
      register: (tabValue, entryId, value) => {
        setEntries((prev) => {
          const next = new Map(prev);
          next.set(`${tabValue}::${entryId}`, value);
          return next;
        });
      },
      unregister: (tabValue, entryId) => {
        setEntries((prev) => {
          const key = `${tabValue}::${entryId}`;
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      },
    }),
    []
  );

  const state = useMemo<TabSaveState>(() => {
    const dirtyTabs = new Set<string>();
    let active: TabSaveRegistration | null = null;

    for (const [key, entry] of entries) {
      const tabValue = key.slice(0, key.indexOf('::'));
      if (entry.dirty) dirtyTabs.add(tabValue);
      if (tabValue === activeTab && !active) active = entry;
    }

    return { dirtyTabs, active, anyDirty: dirtyTabs.size > 0 };
  }, [entries, activeTab]);

  const provider = useMemo(
    () =>
      function TabSaveProvider(children: ReactNode) {
        return <TabSaveContext.Provider value={registry}>{children}</TabSaveContext.Provider>;
      },
    [registry]
  );

  return { provider, state };
}

/**
 * Lazy-then-keep panel gate. Call ONCE per pane (never per tab — that would be a
 * hook inside a loop) and ask the returned set whether a given tab has ever been
 * opened. A tab mounts on first visit and stays mounted for the life of the pane,
 * so an edited-then-left tab keeps both its draft and its dirty dot.
 */
export function useVisitedTabs(activeTab: string): ReadonlySet<string> {
  const visited = useRef(new Set<string>());
  visited.current.add(activeTab);
  return visited.current;
}
