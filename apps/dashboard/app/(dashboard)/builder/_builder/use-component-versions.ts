'use client';

// useComponentVersions — resolves the EXACT pinned version of every `custom:*`
// placement for the canvas preview (docs/53 Gap 1). The components map the editor
// loads carries each component's LATEST version; a placement pinned to an older
// version would otherwise preview as the latest (a WYSIWYG mismatch with publish,
// which is always faithful to the pin).
//
// This hook scans the tree for placements pinned BELOW their component's latest,
// lazily fetches those exact versions (cached by `key@version`), and returns a
// resolver the canvas uses to expand each placement at its real pinned version.
// Until an older version arrives it falls back to the latest (so a placement
// always renders something — a brief latest→pinned settle beats a blank), and the
// component's existence is still the missing-vs-present signal.

import * as React from 'react';
import {
  collectComponentRefs,
  type BuilderNode,
  type ComponentDto,
  type ResolvedComponentVersion,
} from '@sparx/builder-schemas';

import { getComponentVersion } from '../components/_lib/component-actions';

export type VersionResolver = (
  key: string,
  version: number | null
) => ResolvedComponentVersion | null;

export function useComponentVersions(
  components: ReadonlyMap<string, ComponentDto> | undefined,
  tree: BuilderNode | null
): VersionResolver {
  const [cache, setCache] = React.useState<ReadonlyMap<string, ResolvedComponentVersion>>(
    () => new Map()
  );

  // Which (key@version) pins differ from their component's latest — the ones whose
  // exact tree we must fetch (latest is already in the components map).
  const needed = React.useMemo(() => {
    if (!components || !tree) return [] as { key: string; version: number }[];
    const out: { key: string; version: number }[] = [];
    const seen = new Set<string>();
    for (const ref of collectComponentRefs(tree)) {
      const comp = components.get(ref.key);
      if (!comp || ref.version == null || ref.version >= comp.latestVersion) continue;
      const id = `${ref.key}@${ref.version}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ key: ref.key, version: ref.version });
    }
    return out;
  }, [components, tree]);

  // A stable trigger so the effect only refetches when the set of needed pins
  // actually changes (not on every tree edit).
  const neededKey = needed.map((n) => `${n.key}@${n.version}`).join(',');

  React.useEffect(() => {
    const missing = needed.filter((n) => !cache.has(`${n.key}@${n.version}`));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const fetched = await Promise.all(
        missing.map(async (m) => {
          const res = await getComponentVersion(m.key, m.version);
          return res.ok && res.data
            ? ([
                `${m.key}@${m.version}`,
                { tree: res.data.tree, propSpec: res.data.propSpec },
              ] as const)
            : null;
        })
      );
      if (cancelled) return;
      const additions = fetched.filter((f): f is NonNullable<typeof f> => f !== null);
      if (additions.length === 0) return;
      setCache((prev) => {
        const next = new Map(prev);
        for (const [id, v] of additions) next.set(id, v);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // `needed` is recomputed from `neededKey`; depending on the string (not the
    // array identity) keeps the effect from re-running on unrelated tree edits.
  }, [neededKey, needed, cache]);

  return React.useCallback(
    (key, version) => {
      const comp = components?.get(key);
      if (!comp) return null;
      // Latest (or unpinned) → the already-loaded latest content.
      if (version == null || version >= comp.latestVersion) {
        return { tree: comp.tree, propSpec: comp.propSpec };
      }
      // An older pin: the exact version if fetched, else latest as a placeholder
      // until it arrives (never the missing state for a real-but-old pin).
      return cache.get(`${key}@${version}`) ?? { tree: comp.tree, propSpec: comp.propSpec };
    },
    [components, cache]
  );
}
