'use client';

// Canvas commerce overlay (docs/98 Pillar 7). A tree that PINS a product or REPEATS
// a collection needs the REAL products hydrated so the editor canvas previews what
// the published site will render — not the generic sample. This hook collects the
// tree's commerce refs, fetches the matching products (debounced, off the main
// thread via a server action), and returns a `DataSources` overlay carrying the
// reserved `__pins` / `__sources` roots the shared resolver reads. The caller merges
// it over `buildPreviewData(...)`; until it resolves (or for an unpinned tree) the
// overlay is empty and the canvas falls back to the sample product.

import * as React from 'react';

import { collectBindingRefs, type DataSources } from '@sparx/builder-schemas';

import type { BuilderNode } from './model';
import { hydrateCommerceForBuilder } from '../_lib/commerce-binding-actions';

const EMPTY: DataSources = {};

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
    const timer = setTimeout(() => {
      void hydrateCommerceForBuilder(refs).then((data) => {
        if (alive) setOverlay(data);
      });
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
