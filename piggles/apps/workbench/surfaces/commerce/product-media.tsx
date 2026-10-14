'use client';

// The Media tab: the photos, and WHEN each one is shown. Gallery moves (upload,
// order, main photo, take off) save on click; "where this photo shows" is a form, so
// it is the one draft handed to the toolbar's Save. The main photo is always first.

import { useEffect, useState } from 'react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useConfirm } from '../../lib/confirm';
import { MediaPickerProvider } from '../cms/media-picker';
import { PhotoGallery } from './product-media-gallery';
import { ImageDetails } from './product-media-details';
import { useGalleryActions } from './product-media-actions';
import { useBindingDraft, useMediaData } from './product-media-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { SaveFailure } from '@/components/save-failure';
import type { Product, ProductImage } from './products-data';
import type { Binding } from './product-media-binding';

type Gallery = ReturnType<typeof useGalleryActions>;
type MediaData = ReturnType<typeof useMediaData>;

function ProductGallery({
  product,
  data,
  selectedId,
  gallery,
  onSelect,
}: {
  product: Product;
  data: MediaData;
  selectedId: string | null;
  gallery: Gallery;
  onSelect: (imageId: string | null) => void;
}) {
  return (
    <PhotoGallery
      productTitle={product.title}
      images={data.images}
      assets={data.assets}
      variants={data.variants}
      options={data.options}
      selectedId={selectedId}
      loading={data.media.isPending || data.variantsQuery.isPending}
      uploading={gallery.uploading}
      onSelect={onSelect}
      onFiles={(files) => void gallery.addFiles(files)}
      onChooseExisting={(chosen) => void gallery.addExisting(chosen)}
      onReject={gallery.setFailure}
    />
  );
}

function SelectedDetails({
  selected,
  data,
  binding,
  gallery,
  onDraftChange,
}: {
  selected: ProductImage;
  data: MediaData;
  binding: Binding;
  gallery: Gallery;
  onDraftChange: (next: Binding) => void;
}) {
  const { images, assets, variants, options } = data;
  const selectedIndex = images.findIndex((row) => row.id === selected.id);
  return (
    <ImageDetails
      image={selected}
      index={selectedIndex}
      total={images.length}
      canMoveEarlier={
        !selected.isPrimary && selectedIndex > 0 && !images[selectedIndex - 1]?.isPrimary
      }
      canMoveLater={!selected.isPrimary && selectedIndex < images.length - 1}
      asset={assets.get(selected.mediaAssetId) ?? null}
      variants={variants}
      options={options}
      draft={binding}
      busy={gallery.busy}
      onDraftChange={onDraftChange}
      onMove={(delta) => {
        gallery.move(selectedIndex, delta);
      }}
      onSetPrimary={() => {
        gallery.makeMain(selected.id);
      }}
      onRemove={() => {
        void gallery.takeOff(selected);
      }}
    />
  );
}

const DISCARD_PHOTO_CHANGES = {
  title: 'Discard the changes to this photo?',
  description:
    'The description and the rules for when it shows have not been saved yet. Moving to another photo loses them.',
  confirmLabel: 'Discard them',
  cancelLabel: 'Stay on this photo',
  color: 'warning',
} as const;

function PhotosLoadError({ media }: { media: MediaData['media'] }) {
  return (
    <PaneLoadError
      title="Could not load this product's photos"
      description="This is a problem reaching the server. Nothing about the photos has changed. They just could not be read just now."
      error={media.error}
      noun="product"
      onRetry={() => {
        void media.refetch();
      }}
    />
  );
}

/** The selected photo, cleared when it disappears, and a guard on leaving a draft. */
function useSelection(images: ProductImage[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A photo removed elsewhere (or by us) must not leave the details panel open on it.
  useEffect(() => {
    if (selectedId && !images.some((image) => image.id === selectedId)) setSelectedId(null);
  }, [images, selectedId]);
  const selected = images.find((image) => image.id === selectedId) ?? null;
  return { selectedId, setSelectedId, selected };
}

export function ProductMediaTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const confirm = useConfirm();
  const data = useMediaData(product.id);
  const { selectedId, setSelectedId, selected } = useSelection(data.images);
  const gallery = useGalleryActions(product, data.images, data.assets, () => {
    setSelectedId(null);
  });
  const { binding, bindingDirty, setEdit } = useBindingDraft(product.id, selected, data.options);

  // Moving off a photo with unsaved settings would drop them silently, so it asks.
  const selectImage = async (imageId: string | null) => {
    if (bindingDirty && imageId !== selectedId) {
      if (!(await confirm(DISCARD_PHOTO_CHANGES))) return;
      setEdit(null);
    }
    setSelectedId(imageId);
  };

  // A failed load REPLACES the tab: an empty gallery beside a live upload box would
  // invite someone to re-upload photos that are already there.
  if (data.media.isError) return <PhotosLoadError media={data.media} />;

  return (
    // `source="product"` so the picker OPENS on this shop's product photographs.
    <MediaPickerProvider source="product">
      <div className="flex flex-col gap-4">
        {/* ONE message, the server's own sentence when it gave one, above the
            gallery because every action below can raise it. */}
        <SaveFailure title="That did not work" message={gallery.failure} />
        <ProductGallery
          product={product}
          data={data}
          selectedId={selectedId}
          gallery={gallery}
          onSelect={(imageId) => void selectImage(imageId)}
        />
        {selected && binding ? (
          <SelectedDetails
            selected={selected}
            data={data}
            binding={binding}
            gallery={gallery}
            onDraftChange={(next) => setEdit({ imageId: selected.id, binding: next })}
          />
        ) : null}
      </div>
    </MediaPickerProvider>
  );
}
