'use client';

// The gallery itself: the tiles, and the box you drop files on.
//
// Every action reachable from here commits the moment it is clicked, so this
// component holds no draft — it reports what was chosen and what was rejected,
// and the tab does the writing.

import Image from 'next/image';
import { Badge, Dropzone, EmptyState, Text } from '@wizeworks/silicaui-react';
import { faImageSlash, faUpload } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { FormSection } from '../../components/form-section';
import { ACCEPTED_PHOTOS, MAX_PHOTO_BYTES, bindingSummary } from './product-media-binding';
import { ChooseFromLibrary } from './product-media-library';
import type { PickedAsset } from '../cms/media-picker';
import type { MediaAsset, ProductImage, ProductOption, Variant } from './products-data';

export function PhotoGallery({
  productTitle,
  images,
  assets,
  variants,
  options,
  selectedId,
  loading,
  uploading,
  onSelect,
  onFiles,
  onChooseExisting,
  onReject,
}: {
  productTitle: string;
  images: ProductImage[];
  assets: ReadonlyMap<string, MediaAsset>;
  variants: Variant[];
  options: ProductOption[];
  selectedId: string | null;
  loading: boolean;
  uploading: boolean;
  onSelect: (imageId: string | null) => void;
  onFiles: (files: File[]) => void;
  onChooseExisting: (assets: PickedAsset[]) => void;
  onReject: (message: string) => void;
}) {
  return (
    <FormSection
      title="Photos"
      description={
        images.length > 0
          ? 'Shoppers see these in this order. Your main photo always comes first — it is the one used in lists, on cards and in search results.'
          : 'The pictures shoppers see on this product’s page.'
      }
    >
      {loading ? (
        <PaneWaiting />
      ) : images.length === 0 ? (
        <EmptyState
          icon={<Icon glyph={faImageSlash} className="size-6" aria-hidden />}
          title="No photos yet"
          description="A product with a photo sells; a product without one looks unfinished. Choose one you have already, or drop a new file on the box below."
          size="sm"
        />
      ) : (
        <>
          {/* Says how to reach everything else on this tab, and sits INSIDE the
              card rather than on the bare pane below it — a line of text
              floating on the recessed surface is anchored to nothing and reads
              as belonging to neither card. */}
          {selectedId ? null : (
            <Text className="text-sm">
              Choose a photo to give it a description, say when it shows, move it, or make it the
              main one.
            </Text>
          )}
          <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3 @3xl:grid-cols-4">
            {images.map((image, index) => (
              <PhotoTile
                key={image.id}
                image={image}
                index={index}
                productTitle={productTitle}
                asset={assets.get(image.mediaAssetId)}
                pinned={bindingSummary(image, variants, options)}
                isSelected={image.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}

      {/* Two ways in, and the library one first: a business that has photographed
          a run has these pictures already, and the file input alone sent them
          back to their hard drive for a copy they had uploaded once. */}
      <ChooseFromLibrary disabled={uploading} onChosen={onChooseExisting} />

      <Dropzone
        accept={ACCEPTED_PHOTOS}
        maxSize={MAX_PHOTO_BYTES}
        disabled={uploading}
        icon={<Icon glyph={faUpload} className="size-5" aria-hidden />}
        title={uploading ? 'Adding your photos…' : 'Drop photos here, or click to choose files'}
        hint="JPEG, PNG, WebP, AVIF or GIF, up to 8 MB each."
        onFiles={onFiles}
        onReject={(rejections) => {
          // The server would reject these too, but only after the bytes had gone
          // up. Saying which file and why, here, is the useful version.
          onReject(
            rejections
              .map(
                (rejection) =>
                  `“${rejection.file.name}” was not added — it is either too large or not a picture.`
              )
              .join(' ')
          );
        }}
      />
    </FormSection>
  );
}

function PhotoTile({
  image,
  index,
  productTitle,
  asset,
  pinned,
  isSelected,
  onSelect,
}: {
  image: ProductImage;
  index: number;
  productTitle: string;
  asset: MediaAsset | undefined;
  pinned: string | null;
  isSelected: boolean;
  onSelect: (imageId: string | null) => void;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      {/* A real <button>, not a div with a handler — this is the selection
          control for the panel below it. */}
      <button
        type="button"
        aria-pressed={isSelected}
        className={`bg-base-200 rounded-box relative aspect-square w-full overflow-hidden ${
          isSelected ? 'ring-2 ring-[color:var(--color-module)] ring-offset-2' : ''
        }`}
        onClick={() => {
          onSelect(isSelected ? null : image.id);
        }}
      >
        {asset?.url ? (
          <Image
            src={asset.url}
            alt={image.alt ?? asset.altText ?? `Photo ${String(index + 1)} of ${productTitle}`}
            fill
            sizes="(min-width: 1024px) 200px, 45vw"
            className="object-cover"
            unoptimized={!asset.canOptimize || asset.mimeType === 'image/gif'}
          />
        ) : (
          <span className="flex h-full items-center justify-center p-2 text-sm">
            {asset?.status === 'uploading' ? 'Still processing…' : 'No preview'}
          </span>
        )}
        {image.isPrimary ? (
          <span className="absolute top-1.5 left-1.5">
            <Badge color="success" variant="soft" size="sm">
              Main
            </Badge>
          </span>
        ) : null}
      </button>
      {pinned ? (
        <Text as="span" className="truncate text-sm">
          {pinned}
        </Text>
      ) : null}
    </li>
  );
}
