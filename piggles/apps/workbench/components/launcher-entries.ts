'use client';

// What rows the launcher has to offer, before anything is typed.
//
// Two sources, one shape. Surfaces come from the registry and are filtered here;
// records come from the platform's search index already filtered by the server.
// Both are gated by the SAME visibility rule as the rail and the mobile drawer —
// the palette is a faster route to a surface, never a wider one.

import { useMemo } from 'react';
import { routeAcceptsId, routeForEntity } from '@wizeworks/links';
import { useFavorites } from '../lib/api/shell-data';
import { useDebouncedValue, useRecordSearch } from '../lib/api/search';
import { getSurface, listedSurfaces, resolveTitle } from '../lib/surfaces/registry';
import {
  surfaceIsVisible,
  useKnownModules,
  useReachableModules,
} from '../lib/surfaces/use-visible-nav';
import { moduleLabel } from '../lib/surfaces/nav';
import { useWorkbench } from '../lib/workbench/context';
import { useFeedback } from './feedback/provider';
import { groupLabel, targetFor, type Entry } from './launcher-match';

/** Every screen this viewer can open, plus the one action that is not a screen. */
export function useNavEntries(): Entry[] {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const { data: favorites } = useFavorites();
  const reachable = useReachableModules();
  const known = useKnownModules();

  return useMemo<Entry[]>(() => {
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
}

/**
 * The live record hits, each routed to the surface that opens it.
 *
 * A hit whose type has no route, or whose surface is in a module this viewer
 * can't reach, is dropped rather than shown as a dead end.
 *
 * The query is debounced so a burst of typing fires one search, not one per
 * keystroke; the surface filter stays on the live value.
 */
export function useRecordEntries(
  query: string,
  open: boolean
): {
  entries: Entry[];
  searching: boolean;
} {
  const { controller } = useWorkbench();
  const reachable = useReachableModules();
  const known = useKnownModules();
  const debounced = useDebouncedValue(query, 180);
  const records = useRecordSearch(open ? debounced : '');

  const entries = useMemo<Entry[]>(() => {
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

  return { entries, searching: records.isLoading };
}
