'use client';

// Product Media tab (docs/09). Manage the product-level image gallery: add from
// the CMS media library, star one as the hero, remove. Mirrors the wizard's
// Media step but lives in the detail editor and resolves thumbnails through the
// public media REDIRECT (/v1/public/media/:id?tenant=slug) rather than the
// transcoded-variant list — so HOT-LINKED dropship images (whose MediaAsset.key
// is an external URL with no transcoded variants) render here too. That redirect
// is the one resolver that works for both stored uploads and external keys; the
// authed variant list returns null for hot-links, which is why the old stub-era
// gallery showed nothing for imported products.

import * as React from 'react';
import { ImageIcon, Plus, Star, Trash } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Spinner,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import {
  addVariantImageAction,
  listProductImagesAction,
  removeVariantImageAction,
  setPrimaryVariantImageAction,
  type ProductImageRow,
} from '../../../variant-actions';
import { MediaPicker, type PickedAsset } from '../../../../cms/_components/media-picker';

// Browser-reachable public API origin — the redirect <img> loads in the browser,
// so it must use the PUBLIC gateway (NEXT_PUBLIC_API_URL → api.sparx.works in
// prod, localhost:3100 in dev), never the internal server-only URL. Mirrors
// apps/site/lib/media.ts + builder/_brand/lib/api.ts publicMediaUrl().
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

function mediaUrl(mediaAssetId: string, tenantSlug: string): string {
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(mediaAssetId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

interface ProductMediaPanelProps {
  productId: string;
  tenantSlug: string;
  // Server-rendered images, so the gallery paints immediately (no load flash)
  // and matches the count badge on the Media tab trigger.
  initialImages?: ProductImageRow[];
}

export function ProductMediaPanel({
  productId,
  tenantSlug,
  initialImages,
}: ProductMediaPanelProps) {
  const confirm = useConfirm();
  const [loading, setLoading] = React.useState(initialImages === undefined);
  const [images, setImages] = React.useState<ProductImageRow[]>(initialImages ?? []);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Stable display order: hero first, then ascending position. The hero badge
  // still marks it, but leading with it matches how lists/search pick the image.
  const ordered = React.useMemo(
    () =>
      [...images].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.position - b.position;
      }),
    [images]
  );

  const reloadImages = React.useCallback(async () => {
    const res = await listProductImagesAction(productId);
    if (res.ok) setImages(res.data);
  }, [productId]);

  React.useEffect(() => {
    // Skip the fetch when the server already handed us a fresh snapshot — the
    // detail page is force-dynamic, so initialImages is current per render.
    if (initialImages !== undefined) return;
    let cancelled = false;
    void listProductImagesAction(productId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setImages(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, initialImages]);

  async function onPick(asset: PickedAsset) {
    setPickerOpen(false);
    setBusy(true);
    try {
      const res = await addVariantImageAction(productId, {
        productId,
        mediaAssetId: asset.assetId,
        position: images.length,
        ...(asset.alt ? { alt: asset.alt } : {}),
      });
      if (!res.ok) {
        toast.error("Couldn't add image", { description: res.error.message });
        return;
      }
      await reloadImages();
      toast.success('Image added');
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(imageId: string) {
    setBusy(true);
    try {
      const res = await setPrimaryVariantImageAction(productId, imageId);
      if (!res.ok) {
        toast.error("Couldn't set the main image", { description: res.error.message });
        return;
      }
      await reloadImages();
      toast.success('Main image updated', {
        description: 'This is the photo shown in lists, search, and social shares.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: string) {
    const ok = await confirm({
      title: 'Remove this image?',
      description:
        'It will no longer show on the product. The original file stays in your media library.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await removeVariantImageAction(productId, imageId);
      if (!res.ok) {
        toast.error("Couldn't remove image", { description: res.error.message });
        return;
      }
      await reloadImages();
      toast.success('Image removed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={3} wrap>
          <Stack gap={1}>
            <Heading level={3}>Photos</Heading>
            <Text variant="muted" size="sm">
              Images shown on the product across every variant. Star one as the main image used in
              lists, search, and social shares.
            </Text>
          </Stack>
          {images.length > 0 && (
            <Badge color="neutral" variant="soft" size="sm">
              {images.length} {images.length === 1 ? 'photo' : 'photos'}
            </Badge>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Stack
            direction="row"
            align="center"
            gap={2}
            className="py-8 text-[var(--color-text-muted)]"
          >
            <Spinner className="h-4 w-4" /> Loading photos…
          </Stack>
        ) : (
          <Stack gap={4}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {ordered.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]"
                >
                  <img
                    src={mediaUrl(img.mediaAssetId, tenantSlug)}
                    alt={img.alt ?? ''}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {img.isPrimary && (
                    <span className="absolute top-1.5 left-1.5">
                      <Badge color="warning" variant="soft" size="sm">
                        Main
                      </Badge>
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-black/45 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
              ))}

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
              <Stack
                direction="row"
                align="center"
                gap={2}
                className="text-[var(--color-text-muted)]"
              >
                <ImageIcon className="h-4 w-4" />
                <Text size="sm" variant="muted">
                  No photos yet. Add at least one so the product looks its best.
                </Text>
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(a) => void onPick(a)}
        accept={['image/*']}
      />
    </Card>
  );
}
