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
import { routeAcceptsId, routeForEntity } from '@sparx/links';
import {
  surfaceIsVisible,
  useKnownModules,
  useReachableModules,
} from '../lib/surfaces/use-visible-nav';
import { moduleLabel } from '../lib/surfaces/nav';
import type { WorkbenchModule } from './module-scope';
import { useWorkbench } from '../lib/workbench/context';
import { useFeedback } from './feedback/provider';

/**
 * The heading a surface sits under in the palette.
 *
 * This used to title-case the module KEY, which produced "Crm", "B2b" and "Seo"
 * — the raw slug with a capital letter, in the one place the app is supposed to
 * be findable by someone who does not know what anything is called. It now asks
 * the same function the rail and the navigation panel ask, so all three agree
 * and a brand that renames a module renames it everywhere at once
 * (lib/product.ts).
 */
function groupLabel(module: string): string {
  return moduleLabel(module as WorkbenchModule);
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
  /** Whose app this belongs to, so the row's glyph can wear that app's hue. */
  module?: WorkbenchModule;
  run: (mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}

/**
 * Whether `needle` starts a word inside `haystack` — "orders" matches "Customer
 * orders" but not "reorders".
 *
 * Hand-rolled rather than a regex because the needle is whatever somebody typed:
 * a query containing `(` or `*` would either throw or quietly mean something
 * else. Both strings arrive lowercased.
 */
function startsAWord(haystack: string, needle: string): boolean {
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    const before = at === 0 ? '' : haystack.charAt(at - 1);
    if (before === '' || !/[a-z0-9]/.test(before)) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}

/**
 * How well one row answers what was typed. 0 means it does not.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The filter used to be a single `includes` across the label, the GROUP and the
 * keywords, with the results left in registry order. Typing "customers" matched
 * every screen in the Customers app — because they all carry "Customers" as
 * their group — and the one row actually called Customers came out THIRD, under
 * "How this app behaves" and "Booking links". The launcher is the fastest route
 * in the product and typing a screen's name did not put that screen first.
 *
 * The ladder is what a person means, strongest first: the exact name, then a
 * name starting with it, then a name containing it as a word, then anywhere in
 * the name, then the words we tagged it with, and last the app it lives in — a
 * group match alone is the weakest possible evidence and must never outrank a
 * real name.
 */
function score(entry: Entry, query: string): number {
  const label = entry.label.toLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (startsAWord(label, query)) return 60;
  if (label.includes(query)) return 40;
  const keywords = entry.keywords ?? [];
  if (keywords.some((keyword) => keyword.toLowerCase().startsWith(query))) return 30;
  if (keywords.some((keyword) => keyword.toLowerCase().includes(query))) return 20;
  if (entry.group.toLowerCase().includes(query)) return 10;
  return 0;
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
    const surfaces = listedSurfaces().filter((s) => surfaceIsVisible(s, reachable, known));

    const toEntry = (s: ReturnType<typeof listedSurfaces>[number]): Entry => ({
      id: s.key,
      group: favoriteKeys.has(s.key) ? '★ Favorites' : groupLabel(s.module),
      label: resolveTitle(s, {}),
      icon: s.icon,
      module: s.module,
      keywords: [...(s.keywords ?? []), s.module],
      run: (mods) => controller.open(s.key, undefined, { target: targetFor(mods) }),
    });

    // Sending feedback is the one action that ISN'T a surface — a transient
    // dialog, not a place — so it can't come from the registry and is added by
    // hand. Reading feedback is a listed surface and rides along above.
    const sendFeedback: Entry = {
      id: 'platform.feedback.send',
      group: moduleLabel('platform'),
      label: 'Send feedback',
      module: 'platform',
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
      const route = routeForEntity(hit.entityType);
      if (!route) continue;
      const surface = getSurface(route.surface);
      if (!surface || !surfaceIsVisible(surface, reachable, known)) continue;
      // A handful of entity types have no detail surface — a review is worked in
      // a queue, a page is authored in the builder — so their home is a LIST and
      // it takes no id. That falls out of whether the address has a parameter,
      // rather than being a flag someone has to keep in step with the route.
      const carriesId = routeAcceptsId(route);
      out.push({
        id: `record:${hit.key}`,
        group: route.entityLabel ?? surface.title.toString(),
        label: hit.title || 'Untitled',
        subtitle: hit.subtitle,
        icon: surface.icon,
        module: surface.module,
        run: (mods) =>
          controller.open(route.surface, carriesId ? { id: hit.recordId } : undefined, {
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

    const scored = navEntries
      .map((entry) => ({ entry, rank: score(entry, q) }))
      .filter((row) => row.rank > 0);

    // Groups are ranked by their BEST member, then members within a group by
    // their own rank. Sorting on member rank alone would scatter one app's
    // screens through the list — and because the render re-collects rows into
    // group buckets while the keyboard walks the flat array, a scattered group
    // would make ↓ jump around the screen. Contiguous groups keep the two in
    // step. `sort` is stable, so equal ranks stay in registry order.
    const best = new Map<string, number>();
    for (const { entry, rank } of scored) {
      best.set(entry.group, Math.max(best.get(entry.group) ?? 0, rank));
    }
    scored.sort(
      (a, b) => (best.get(b.entry.group) ?? 0) - (best.get(a.entry.group) ?? 0) || b.rank - a.rank
    );

    return [...scored.map((row) => row.entry), ...recordEntries];
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
                  {/* The app this run of rows belongs to. 14px, the caption
                      floor — at `text-xs` with tracking it was reading as an
                      uppercase-ish micro-label above the thing it introduces,
                      which is the shape RULE #2 bans. It is a list heading, so
                      it stays a plain sentence at a readable size. */}
                  <div className="px-3 pt-2 pb-1 text-sm font-semibold">{group}</div>
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
                        // The hue bridge, written straight onto the row rather
                        // than through <ModuleScope>: that component renders a
                        // <div>, and flow content inside a <button> is invalid
                        // markup. The attribute IS the whole mechanism — the
                        // `data-module` ⇒ `--color-module` mapping lives in
                        // @piggles/brand's theme.css — so nothing is lost.
                        //
                        // Here the colour genuinely distinguishes A from B: one
                        // list holds screens from fifteen different apps, and
                        // the glyph's hue says which before the label is read.
                        data-module={entry.module}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                          isActive ? 'bg-base-200' : 'hover:bg-base-200'
                        }`}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={(event) =>
                          select(index, { shiftKey: event.shiftKey, altKey: event.altKey })
                        }
                      >
                        {Icon ? <Icon className="text-module size-4 shrink-0" aria-hidden /> : null}
                        <span className="min-w-0 flex-1 truncate text-base font-medium">
                          {entry.label}
                        </span>
                        {entry.subtitle ? (
                          <span className="max-w-[45%] shrink truncate text-sm">
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
          <div className="border-base-300 flex items-center gap-4 border-t px-3 py-2 text-xs">
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
