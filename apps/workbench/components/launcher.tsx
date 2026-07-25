'use client';

// The launcher — how anything gets opened, and how anything gets found.
//
// It answers two questions in one box. "Where is X" is NAVIGATION: a flat
// catalog of surfaces (registry.ts), filtered locally as you type — typing "inv"
// and pressing Enter beats three clicks down a tree. "Which X" is RECORD SEARCH:
// a live query against the platform's Typesense index (lib/api/search.ts) that
// finds the actual order, customer, product, or deal by name. Surfaces sort
// first (you usually know the screen you want); matching records follow, grouped
// by kind.
//
// The modifier keys are the other half of the story, and they are what make this
// a workbench rather than a launcher: Enter opens a tab, ⇧Enter opens it
// alongside what you're looking at, ⌥Enter tears it into its own window. That
// contract is identical for a surface and a record — the destination is stated
// at the moment you ask for it, whichever kind of thing you asked for.
//
// This is a purpose-built async palette (composed from the silica Dialog +
// SearchInput + Kbd primitives) rather than silica's <CommandPalette>, which
// owns its input internally and can only ever filter a static list — it has no
// seam to feed live server results through. Brandon approved the composition.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Dialog, DialogContent, DialogTitle, Kbd, SearchInput } from '@wizeworks/silicaui-react';
import type { LucideIcon } from 'lucide-react';
import { useFavorites } from '../lib/api/shell-data';
import { useDebouncedValue, useRecordSearch } from '../lib/api/search';
import {
  getSurface,
  listedSurfaces,
  resolveTitle,
  type OpenTarget,
} from '../lib/surfaces/registry';
import { recordRoute } from '../lib/surfaces/record-routes';
import {
  moduleIsVisible,
  useKnownModules,
  useReachableModules,
} from '../lib/surfaces/use-visible-nav';
import { useWorkbench } from '../lib/workbench/context';
import { useFeedback } from './feedback/provider';

/** Title-cases a module key for the palette's navigation group headings. */
function groupLabel(module: string): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

/** The modifier held at selection decides where the pane lands. */
function targetFor(mods: { shiftKey?: boolean; altKey?: boolean }): OpenTarget {
  return mods.altKey ? 'window' : mods.shiftKey ? 'beside' : 'tab';
}

/** One selectable row — a surface to open, a record to open, or an action. */
interface Entry {
  id: string;
  group: string;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Terms the local filter matches surfaces on. Records are pre-filtered by the server. */
  keywords?: string[];
  run: (mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}

export function Launcher({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const { data: favorites } = useFavorites();
  const reachable = useReachableModules();
  const known = useKnownModules();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Records wait on a debounced query so a burst of typing fires one search, not
  // one per keystroke; surface filtering below stays on the live value.
  const debounced = useDebouncedValue(query, 180);
  const records = useRecordSearch(open ? debounced : '');

  // Bind ⌘K / Ctrl+K here — silica's <CommandPalette> used to own this, and it
  // left with it. Only one Launcher is mounted at a time (the compact shell
  // returns before the dock renders), so there's no double-toggle.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Each fresh open starts clean — an old query lingering behind the backdrop
  // reads as stale, and the highlight must return to the top.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  // ── Navigation entries: favorites + surfaces, gated by the SAME rule as the
  //    rail and mobile drawer. The palette is a faster route to a surface, never
  //    a wider one — a teammate restricted to Invoicing can't reach Commerce by
  //    typing "orders", and a tenant that never turned Commerce on can't open a
  //    surface that would 404. ──────────────────────────────────────────────
  const navEntries = useMemo<Entry[]>(() => {
    const favoriteKeys = new Set((favorites ?? []).map((f) => f.actionId));
    const surfaces = listedSurfaces().filter((s) => moduleIsVisible(s.module, reachable, known));

    const toEntry = (s: ReturnType<typeof listedSurfaces>[number]): Entry => ({
      id: s.key,
      group: favoriteKeys.has(s.key) ? '★ Favorites' : groupLabel(s.module),
      label: resolveTitle(s, {}),
      icon: s.icon,
      keywords: [...(s.keywords ?? []), s.module],
      run: (mods) => controller.open(s.key, undefined, { target: targetFor(mods) }),
    });

    // Sending feedback is the one action that ISN'T a surface — a transient
    // dialog, not a place — so it can't come from the registry and is added by
    // hand. Reading feedback is a listed surface and rides along above.
    const sendFeedback: Entry = {
      id: 'platform.feedback.send',
      group: 'Platform',
      label: 'Send feedback',
      keywords: ['feedback', 'support', 'bug', 'problem', 'idea', 'suggestion', 'contact'],
      run: () => feedback.openSend({ source: 'command' }),
    };

    // Favorites first so their group heads the palette; groups then render in
    // first-appearance order.
    return [
      ...surfaces.filter((s) => favoriteKeys.has(s.key)).map(toEntry),
      ...surfaces.filter((s) => !favoriteKeys.has(s.key)).map(toEntry),
      sendFeedback,
    ];
  }, [controller, favorites, reachable, known, feedback]);

  // ── Record entries: each Typesense hit routed to its surface. A hit whose
  //    type has no route, or whose surface is in a module this viewer can't
  //    reach, is dropped rather than shown as a dead end — the same visibility
  //    gate the surfaces use, applied to the surface a record would open. ────
  const recordEntries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const hit of records.hits) {
      const route = recordRoute(hit.entityType);
      if (!route) continue;
      const surface = getSurface(route.surface);
      if (!surface || !moduleIsVisible(surface.module, reachable, known)) continue;
      out.push({
        id: `record:${hit.key}`,
        group: route.label,
        label: hit.title || 'Untitled',
        subtitle: hit.subtitle,
        icon: surface.icon,
        run: (mods) =>
          controller.open(route.surface, route.withId ? { id: hit.recordId } : undefined, {
            target: targetFor(mods),
          }),
      });
    }
    return out;
  }, [records.hits, reachable, known, controller]);

  // Surfaces filter locally on the live query; records arrive already filtered.
  // Empty query is the launcher's resting state: navigation only, no records.
  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navEntries;
    const nav = navEntries.filter((e) =>
      [e.label, e.group, ...(e.keywords ?? [])].join(' ').toLowerCase().includes(q)
    );
    return [...nav, ...recordEntries];
  }, [query, navEntries, recordEntries]);

  // Keep the highlight in range as the list shrinks/grows under it.
  useEffect(() => {
    setActiveIndex((i) => (i >= entries.length ? 0 : i));
  }, [entries.length]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, entries]);

  const groups = useMemo(() => {
    const map = new Map<string, { entry: Entry; index: number }[]>();
    entries.forEach((entry, index) => {
      const bucket = map.get(entry.group);
      if (bucket) bucket.push({ entry, index });
      else map.set(entry.group, [{ entry, index }]);
    });
    return [...map.entries()];
  }, [entries]);

  const move = (dir: 1 | -1) => {
    const n = entries.length;
    if (n === 0) return;
    setActiveIndex((i) => (i + dir + n) % n);
  };

  const select = (index: number, mods: { shiftKey?: boolean; altKey?: boolean }) => {
    const entry = entries[index];
    if (!entry) return;
    entry.run(mods);
    onOpenChange(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(activeIndex, { shiftKey: e.shiftKey, altKey: e.altKey });
    }
  };

  const showEmpty = entries.length === 0;
  const searching = records.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden p-0">
        <DialogTitle className="sr-only">Search everything</DialogTitle>

        {/* The keydown handler rides the search field itself — arrows move the
            highlight, Enter opens with the held modifier — exactly where the
            typing already is. The Dialog moves focus here on open (first
            focusable), so no autofocus prop is needed. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-base-300 border-b p-3">
            <SearchInput
              size="md"
              value={query}
              onValueChange={setQuery}
              onKeyDown={onKeyDown}
              aria-label="Search everything"
              placeholder="Search for anything — orders, customers, products…"
            />
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox">
            {showEmpty ? (
              <p className="px-3 py-8 text-center text-sm" role="status">
                {searching
                  ? 'Searching…'
                  : query.trim()
                    ? 'Nothing matches that. Try a different word.'
                    : 'Type to search across every module — or pick a screen to open.'}
              </p>
            ) : (
              groups.map(([group, rows]) => (
                <div key={group} className="mb-1">
                  <div className="text-base-content px-3 pt-2 pb-1 text-xs font-semibold tracking-wide">
                    {group}
                  </div>
                  {rows.map(({ entry, index }) => {
                    const isActive = index === activeIndex;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                          isActive ? 'bg-base-200' : 'hover:bg-base-200'
                        }`}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={(event) =>
                          select(index, { shiftKey: event.shiftKey, altKey: event.altKey })
                        }
                      >
                        {Icon ? (
                          <Icon className="text-base-content size-4 shrink-0" aria-hidden />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {entry.label}
                        </span>
                        {entry.subtitle ? (
                          <span className="text-base-content max-w-[45%] shrink truncate text-sm">
                            {entry.subtitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* The modifier contract, spelled out — the same three destinations for
              a surface and a record. */}
          <div className="border-base-300 text-base-content flex items-center gap-4 border-t px-3 py-2 text-xs">
            <span className="flex items-center gap-1">
              <Kbd size="sm">↵</Kbd> open
            </span>
            <span className="flex items-center gap-1">
              <Kbd size="sm">⇧↵</Kbd> alongside
            </span>
            <span className="flex items-center gap-1">
              <Kbd size="sm">⌥↵</Kbd> new window
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
