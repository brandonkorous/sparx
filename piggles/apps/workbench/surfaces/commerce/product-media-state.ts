'use client';

// The reads behind the Media tab, and its one DRAFT: "where this photo shows".

import { useMemo, useState } from 'react';
import { useTabSave } from './product-tab-save';
import { sameBinding, toBinding, toBindingDraft, type Binding } from './product-media-binding';
import {
  useMediaAssets,
  useProductMedia,
  useProductOptions,
  useProductVariants,
  useSetImageBindings,
  type MediaAsset,
  type ProductOption,
  type ProductImage,
} from './products-data';

/** The photos, the variants and options they can be pinned to, and their files. */
export function useMediaData(productId: string) {
  const media = useProductMedia(productId);
  const variantsQuery = useProductVariants(productId);
  const optionsQuery = useProductOptions(productId);
  const images = useMemo(() => media.data ?? [], [media.data]);
  const variants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const options = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);
  // One request for every file, keyed on the id SET; memoized so a re-render with
  // the same images does not mint a new array and re-key the query.
  const assetIds = useMemo(() => images.map((image) => image.mediaAssetId), [images]);
  const assetsQuery = useMediaAssets(assetIds);
  const assets = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assetsQuery.data ?? []) map.set(asset.id, asset);
    return map;
  }, [assetsQuery.data]);
  return { media, variantsQuery, images, variants, options, assets };
}

// Held by the tab, not the details panel: the tab registers exactly one save with
// the toolbar, and a child that comes and goes with the selection cannot hold it.
export function useBindingDraft(
  productId: string,
  selected: ProductImage | null,
  options: ProductOption[]
) {
  const setBindings = useSetImageBindings(productId);
  const [edit, setEdit] = useState<{ imageId: string; binding: Binding } | null>(null);
  const savedBinding = useMemo(
    () => (selected ? toBindingDraft(selected, options) : null),
    [selected, options]
  );
  // Keyed on the photo, so a stale edit is never shown against a different one.
  const binding = edit?.imageId === selected?.id ? (edit?.binding ?? null) : savedBinding;
  const bindingDirty = Boolean(binding && savedBinding && !sameBinding(binding, savedBinding));

  useTabSave({
    dirty: bindingDirty,
    saving: setBindings.isPending,
    save: async () => {
      // A keyboard shortcut can reach this with nothing selected or changed.
      if (!selected || !binding || !bindingDirty) return;
      // Rejects on failure, on purpose: the toolbar reports the server's own sentence.
      await setBindings.mutateAsync({ variantImageId: selected.id, ...toBinding(binding) });
      setEdit(null);
    },
  });
  return { binding, bindingDirty, setEdit };
}
