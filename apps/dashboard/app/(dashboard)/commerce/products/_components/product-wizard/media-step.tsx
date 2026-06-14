'use client';

// Product wizard — Media step.
//
// Attach product photos without leaving the wizard. Reuses the CMS <MediaPicker>
// (the same asset browser the page editor uses) to choose from the tenant's
// library, attaches each as a PRODUCT-level image (shown for every variant), and
// lets the merchant star one as the hero. Image rows only carry a mediaAssetId,
// so we resolve thumbnails from the media-assets list the same way the picker
// does.

import * as React from 'react';
import { ImageIcon, Plus, Star, Trash } from 'lucide-react';
import { Badge, Button, Spinner, Text, WizardStep, useConfirm } from '@sparx/ui';

import {
  addVariantImageAction,
  listProductImagesAction,
  removeVariantImageAction,
  setPrimaryVariantImageAction,
  type ProductImageRow,
} from '../../../variant-actions';
import { MediaPicker, type PickedAsset } from '../../../../cms/_components/media-picker';
import { listMediaAssetsAction } from '../../../../cms/_components/cms-actions';

interface MediaStepProps {
  productId: string;
  onBack: () => void;
  onComplete: () => void;
}

interface ApiAssetVariant {
  format: string;
  width: number;
  url: string;
}
interface ApiAsset {
  id: string;
  variants?: ApiAssetVariant[];
}

function pickThumb(variants: ApiAssetVariant[] | undefined): string | null {
  if (!variants?.length) return null;
  const webp = variants
    .filter((v) => v.format === 'webp')
    .sort((a, b) => Math.abs(a.width - 800) - Math.abs(b.width - 800));
  return webp[0]?.url ?? variants[0]?.url ?? null;
}

export function MediaStep({ productId, onBack, onComplete }: MediaStepProps) {
  const confirm = useConfirm();
  const [loading, setLoading] = React.useState(true);
  const [images, setImages] = React.useState<ProductImageRow[]>([]);
  const [urlByAsset, setUrlByAsset] = React.useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reloadImages = React.useCallback(async () => {
    const res = await listProductImagesAction(productId);
    if (res.ok) setImages(res.data);
  }, [productId]);

  // On mount, load the attached images AND the asset URL map (so server-loaded
  // images render their thumbnails — rows only carry a mediaAssetId).
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listProductImagesAction(productId), listMediaAssetsAction({ limit: 200 })])
      .then(([imgRes, assetRes]) => {
        if (cancelled) return;
        if (imgRes.ok) setImages(imgRes.data);
        if (assetRes.success) {
          const map: Record<string, string> = {};
          for (const a of assetRes.data as unknown as ApiAsset[]) {
            const thumb = pickThumb(a.variants);
            if (thumb) map[a.id] = thumb;
          }
          setUrlByAsset(map);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function onPick(asset: PickedAsset) {
    setPickerOpen(false);
    setBusy(true);
    setError(null);
    try {
      // Remember the URL immediately so the new tile renders without a refetch.
      setUrlByAsset((m) => ({ ...m, [asset.assetId]: asset.src }));
      const res = await addVariantImageAction(productId, {
        productId,
        mediaAssetId: asset.assetId,
        position: images.length,
        ...(asset.alt ? { alt: asset.alt } : {}),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      await reloadImages();
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(imageId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await setPrimaryVariantImageAction(productId, imageId);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      await reloadImages();
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: string) {
    const ok = await confirm({
      title: 'Remove this image?',
      description:
        'It will no longer show on the product. The original file stays in your library.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await removeVariantImageAction(productId, imageId);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      await reloadImages();
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardStep
      header={{
        title: 'Photos',
        supporting:
          'Add product images. The one you star is the main image shown in lists and search.',
      }}
      actions={{
        onBack,
        onNext: onComplete,
        onSkip: onComplete,
        nextLabel: 'Continue',
        nextDisabled: busy,
      }}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
          <Spinner className="h-4 w-4" /> Loading photos…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => {
              const url = urlByAsset[img.mediaAssetId];
              return (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={img.alt ?? ''}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-[var(--color-text-tertiary)]" />
                    </div>
                  )}
                  {img.isPrimary && (
                    <span className="absolute top-1.5 left-1.5">
                      <Badge color="warning" variant="soft" size="sm">
                        Main
                      </Badge>
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-black/45 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!img.isPrimary && (
                      <Button
                        type="button"
                        variant="soft"
                        size="sm"
                        onClick={() => void makePrimary(img.id)}
                        disabled={busy}
                        leftIcon={<Star className="h-3.5 w-3.5" />}
                      >
                        Star
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="soft"
                      color="danger"
                      size="sm"
                      onClick={() => void remove(img.id)}
                      disabled={busy}
                      aria-label="Remove image"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={busy}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-border-default)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--module-active)] hover:text-[var(--module-active)] disabled:opacity-40"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm">Add image</span>
            </button>
          </div>

          {images.length === 0 && (
            <Text size="sm" variant="muted">
              No photos yet. Add at least one so the product looks its best — or continue and add
              them later.
            </Text>
          )}

          {error && (
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(a) => void onPick(a)}
        accept={['image/*']}
      />
    </WizardStep>
  );
}
