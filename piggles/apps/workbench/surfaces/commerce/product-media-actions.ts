'use client';

// Everything on the Media tab that commits the moment it is clicked: add,
// reorder, make main, take off.
//
// None of these is a draft, so none of them goes through the toolbar's Save. They
// share one failure message and one set of pending flags, which is why they are
// one hook rather than four loose handlers in the tab.

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import {
  productErrorMessage,
  useAddProductImage,
  useRemoveProductImage,
  useReorderProductImages,
  useSetPrimaryImage,
  useUploadMedia,
  type MediaAsset,
  type Product,
  type ProductImage,
} from './products-data';

export interface GalleryActions {
  /** The last thing that went wrong, in the server's own words. */
  failure: string | null;
  setFailure: (message: string | null) => void;
  uploading: boolean;
  busy: { reorder: boolean; primary: boolean; remove: boolean };
  addFiles: (files: File[]) => Promise<void>;
  /** Photos the business already has, chosen from the library rather than uploaded. */
  addExisting: (assets: readonly { id: string; filename: string }[]) => Promise<void>;
  move: (index: number, delta: number) => void;
  makeMain: (imageId: string) => void;
  takeOff: (image: ProductImage) => Promise<void>;
}

export function useGalleryActions(
  product: Product,
  images: ProductImage[],
  assets: ReadonlyMap<string, MediaAsset>,
  onRemoved: () => void
): GalleryActions {
  const toast = useToast();
  const confirm = useConfirm();
  const [failure, setFailure] = useState<string | null>(null);

  const upload = useUploadMedia();
  const addImage = useAddProductImage(product.id);
  const reorder = useReorderProductImages(product.id);
  const setPrimary = useSetPrimaryImage(product.id);
  const removeImage = useRemoveProductImage(product.id);

  const addFiles = async (files: File[]) => {
    setFailure(null);
    // Sequential, not parallel: `position` is assigned from the count so far, and
    // three concurrent adds would all claim the same slot.
    let position = images.length;
    for (const file of files) {
      try {
        const mediaAssetId = await upload.mutateAsync(file);
        await addImage.mutateAsync({ mediaAssetId, position });
        position += 1;
      } catch (error) {
        setFailure(
          productErrorMessage(
            error,
            `“${file.name}” could not be added. Any photos before it were saved.`
          )
        );
        return;
      }
    }
    toast.add({
      title: files.length === 1 ? 'Photo added' : `${String(files.length)} photos added`,
      type: 'success',
    });
  };

  const addExisting = async (assets: readonly { id: string; filename: string }[]) => {
    setFailure(null);
    // Sequential for the same reason as `addFiles`: `position` is assigned from
    // the count so far. There is no upload step — the file is already theirs.
    let position = images.length;
    for (const asset of assets) {
      try {
        await addImage.mutateAsync({ mediaAssetId: asset.id, position });
        position += 1;
      } catch (error) {
        setFailure(
          productErrorMessage(
            error,
            `“${asset.filename}” could not be added. Any photos before it were saved.`
          )
        );
        return;
      }
    }
    toast.add({
      title: assets.length === 1 ? 'Photo added' : `${String(assets.length)} photos added`,
      type: 'success',
    });
  };

  const move = (index: number, delta: number) => {
    const next = [...images];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + delta, 0, moved);
    setFailure(null);
    reorder.mutate(
      next.map((image) => image.id),
      {
        onError: (error) => {
          setFailure(productErrorMessage(error, 'The new order could not be saved.'));
        },
      }
    );
  };

  const makeMain = (imageId: string) => {
    setFailure(null);
    setPrimary.mutate(imageId, {
      onSuccess: () => {
        toast.add({ title: 'Main photo changed', type: 'success' });
      },
      onError: (error) => {
        setFailure(productErrorMessage(error, 'The main photo could not be changed.'));
      },
    });
  };

  const takeOff = async (image: ProductImage) => {
    const name = assets.get(image.mediaAssetId)?.filename ?? 'this photo';
    const ok = await confirm({
      title: `Take ${name} off ${product.title}?`,
      description: image.isPrimary
        ? 'This is the main photo, so lists, cards and search results will fall back to the next one. The file itself stays in your media library and can be added again.'
        : 'It stops showing on your website. The file itself stays in your media library and can be added again.',
      confirmLabel: 'Take it off',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    setFailure(null);
    removeImage.mutate(image.id, {
      onSuccess: () => {
        onRemoved();
        toast.add({ title: 'Photo removed', type: 'success' });
      },
      onError: (error) => {
        setFailure(productErrorMessage(error, 'The photo could not be removed.'));
      },
    });
  };

  return {
    failure,
    setFailure,
    uploading: upload.isPending || addImage.isPending,
    busy: {
      reorder: reorder.isPending,
      primary: setPrimary.isPending,
      remove: removeImage.isPending,
    },
    addFiles,
    addExisting,
    move,
    makeMain,
    takeOff,
  };
}
