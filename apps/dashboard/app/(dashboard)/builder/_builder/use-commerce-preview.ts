'use client';

// Canvas record overlay (docs/98 Pillar 7). A tree that PINS a product / collection /
// category / CMS entry, or REPEATS a collection, needs the REAL records hydrated so
// the editor canvas previews what the published site will render — not the generic
// sample. This hook collects the tree's binding refs, fetches the matching records
// (debounced, off the main thread via server actions for both the commerce + content
// surfaces), and returns a `DataSources` overlay carrying the reserved `__pins` /
// `__sources` roots the shared resolver reads. The caller merges it over
// `buildPreviewData(...)`; until it resolves (or for an unbound tree) the overlay is
// empty and the canvas falls back to the sample data.

import * as React from 'react';

import {
  PINS_ROOT,
  SOURCES_ROOT,
  collectBindingRefs,
  type DataSources,
} from '@sparx/builder-schemas';

import type { BuilderNode } from './model';
import { hydrateCommerceForBuilder } from '../_lib/commerce-binding-actions';
import { hydrateCmsForBuilder } from '../_lib/cms-binding-actions';

const EMPTY: DataSources = {};

/** Merge two overlay roots, deep-merging the reserved `__pins` / `__sources` maps so
 *  the commerce + CMS hydrators' pins coexist (mirrors the site loader's merge). */
function mergeOverlays(a: DataSources, b: DataSources): DataSources {
  const out: DataSources = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const reserved = k === PINS_ROOT || k === SOURCES_ROOT;
    const existing = out[k];
    if (reserved && existing && typeof existing === 'object' && v && typeof v === 'object') {
      out[k] = { ...(existing as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function useCommercePreview(tree: BuilderNode | null): DataSources {
  // The commerce refs the tree binds, and a stable signature of WHICH products /
  // sources they reference — so the fetch only re-runs when that set changes, not
  // on every class/text edit.
  const refs = React.useMemo(() => (tree ? collectBindingRefs(tree) : null), [tree]);
  const key = React.useMemo(() => {
    if (!refs) return '';
    const ents = refs.entities.map((e) => `${e.entity}:${e.id}`).sort();
    const srcs = refs.sources.map((s) => `${s.from}:${s.id ?? ''}:${s.limit ?? ''}`).sort();
    return ents.length || srcs.length ? JSON.stringify([ents, srcs]) : '';
  }, [refs]);

  const [overlay, setOverlay] = React.useState<DataSources>(EMPTY);

  React.useEffect(() => {
    if (!refs || key === '') {
      setOverlay(EMPTY);
      return;
    }
    let alive = true;
    // Coalesce a burst of edits (pick a product, then tweak the limit) into one fetch.
    // Both surfaces hydrate in parallel; their `__pins` are merged (not clobbered).
    const timer = setTimeout(() => {
      void Promise.all([hydrateCommerceForBuilder(refs), hydrateCmsForBuilder(refs)]).then(
        ([commerce, cms]) => {
          if (alive) setOverlay(mergeOverlays(commerce, cms));
        }
      );
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `key` is the meaningful change signal; `refs` is recomputed every render but
    // only triggers a fetch when the referenced product/source SET actually changes.
  }, [key]);

  return overlay;
}
