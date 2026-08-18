'use client';

// A reusable "pick a picture" field.
//
// Categories have an icon and a hero image; collections have a hero image. All
// three are the same act — choose one image from the media library, or upload a
// new one — so it is ONE component rather than three near-copies.
//
// ── Why the picker is a modal, and why that is allowed here ────────────────
//
// The pane rule is "a modal must earn it", and this one clears the bar by the
// stated exemption: its result commits to the PANE'S OWN DRAFT, not the server.
// Choosing an image sets a field on the draft the pane already owns and already
// guards; the pane stays dirty on the picker's behalf, and nothing is lost if
// the dialog is dismissed. (Same shape as the invoice line-editor modal.)

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@wizeworks/query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { ImageOff, ImagePlus, Trash2, Upload } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { api } from '../../lib/api/client';
import { useMediaAssets, useUploadMedia, type MediaAsset } from './products-data';

/* ── The media-library list (images only) ───────────────────────────────── */

interface MediaAssetWire {
  id: string;
  original_filename: string;
  mime_type: string;
  status: string;
  original_url: string | null;
  variants: { id: string; format: string; width: number; height: number; url: string }[];
}

/** Same path-based test the product data layer and next.config use: is this one
 *  of OUR media URLs, so the image optimizer may touch it? A stranger's CDN URL
 *  (blueprint or dropship import) renders unoptimized rather than crashing. */
function isOwnMediaUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url, 'http://localhost').pathname.startsWith('/v1/public/media/');
  } catch {
    return false;
  }
}

function thumbnailUrl(wire: MediaAssetWire): string | null {
  const sorted = [...wire.variants].sort((a, b) => a.width - b.width);
  const big = sorted.find((variant) => variant.width >= 320);
  return big?.url ?? sorted.at(-1)?.url ?? wire.original_url;
}

function toAsset(wire: MediaAssetWire): MediaAsset {
  const url = thumbnailUrl(wire);
  return {
    id: wire.id,
    filename: wire.original_filename,
    mimeType: wire.mime_type,
    width: null,
    height: null,
    altText: null,
    url,
    canOptimize: isOwnMediaUrl(url),
    status: wire.status,
  };
}

function useMediaLibrary(search: string, open: boolean) {
  return useQuery({
    queryKey: ['media', 'library', 'image', { q: search }],
    queryFn: async () => {
      const { items } = await api.list<MediaAssetWire>('/v1/media/assets', {
        type: 'image',
        status: 'ready',
        ...(search ? { q: search } : {}),
        take: 60,
      });
      return items.map(toAsset);
    },
    // Only fetch while the picker is open — the library is otherwise never read.
    enabled: open,
  });
}

/* ── The field ──────────────────────────────────────────────────────────── */

export function MediaField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  /** The chosen media asset id, or null for none. */
  value: string | null;
  onChange: (mediaId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(() => (value ? [value] : []), [value]);
  const assetsQuery = useMediaAssets(ids);
  const asset = assetsQuery.data?.[0] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Text as="span" className="font-medium">
          {label}
        </Text>
        <Text className="text-sm">{description}</Text>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-base-300 bg-base-200 rounded-box relative size-20 shrink-0 overflow-hidden border">
          {value && asset?.url ? (
            <Image
              src={asset.url}
              alt={asset.filename}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={!asset.canOptimize || asset.mimeType === 'image/gif'}
            />
          ) : (
            <span className="flex h-full items-center justify-center">
              <ImageOff className="size-5" aria-hidden />
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              setOpen(true);
            }}
          >
            <ImagePlus className="size-4" aria-hidden />
            {value ? 'Change picture' : 'Choose a picture'}
          </Button>
          {value ? (
            <Button
              size="sm"
              variant="ghost"
              color="neutral"
              onClick={() => {
                onChange(null);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
        <MediaPickerDialog
          selected={value}
          onClose={() => {
            setOpen(false);
          }}
          onPick={(mediaId) => {
            onChange(mediaId);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── The picker dialog ──────────────────────────────────────────────────── */

function MediaPickerDialog({
  selected,
  onClose,
  onPick,
}: {
  selected: string | null;
  onClose: () => void;
  onPick: (mediaId: string) => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const library = useMediaLibrary(search, true);
  const upload = useUploadMedia();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const assets = library.data ?? [];

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (mediaId) => {
        // Straight onto the draft — the newly uploaded image is almost always the
        // one they wanted, so selecting it saves a hunt through the library.
        onPick(mediaId);
      },
      onError: () => {
        toast.add({
          title: 'Could not upload that picture',
          description: 'Nothing was added. Try a different file, or try again in a moment.',
          type: 'error',
        });
      },
    });
  };

  return (
    // PaneScope portals the dialog into the pane that opened it, so choosing an
    // image on one docked collection does not black out the pane beside it.
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next: boolean) => {
          if (!next) onClose();
        }}
      >
        {/* `@container` is load-bearing: a PaneScope'd dialog portals to the
            pane HOST, which sits outside the `@container` on PANE_SHELL, so the
            grid's `@md:`/`@2xl:` steps below matched nothing and the picker
            showed three columns at every width. */}
        <DialogContent className="@container flex max-h-[calc(100%-2rem)] w-full max-w-2xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Choose a picture</DialogTitle>
            <DialogDescription>
              Pick one from your library, or upload a new one. Your choice is not saved until you
              save the whole form.
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-xs min-w-0 flex-1">
              <SearchInput
                size="sm"
                aria-label="Search your pictures"
                placeholder="Search your pictures…"
                value={search}
                onValueChange={setSearch}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                onFile(event.target.files?.[0]);
                // Let the same file be chosen twice in a row.
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="outline"
              color="module"
              className="ml-auto"
              loading={upload.isPending}
              onClick={() => {
                fileRef.current?.click();
              }}
            >
              <Upload className="size-4" aria-hidden />
              Upload
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {library.isError ? (
              <div className="flex flex-col items-start gap-2 p-4">
                <Text>Your library could not be loaded just now.</Text>
                <Button
                  size="sm"
                  variant="outline"
                  color="neutral"
                  onClick={() => {
                    void library.refetch();
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : library.isPending ? (
              <p className="p-4 text-sm" role="status">
                Loading your pictures…
              </p>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center gap-1 p-8 text-center">
                <ImageOff className="size-6" aria-hidden />
                <Text>
                  {search
                    ? `No pictures match “${search.trim()}”.`
                    : 'No pictures yet — upload one to get started.'}
                </Text>
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-5">
                {assets.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      aria-pressed={selected === asset.id}
                      aria-label={`Choose ${asset.filename}`}
                      className={`bg-base-200 rounded-box relative aspect-square w-full overflow-hidden ${
                        selected === asset.id
                          ? 'ring-2 ring-[color:var(--color-module)] ring-offset-2'
                          : ''
                      }`}
                      onClick={() => {
                        onPick(asset.id);
                      }}
                    >
                      {asset.url ? (
                        <Image
                          src={asset.url}
                          alt=""
                          fill
                          sizes="160px"
                          className="object-cover"
                          unoptimized={!asset.canOptimize || asset.mimeType === 'image/gif'}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <ImageOff className="size-4" aria-hidden />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="ghost" color="neutral" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
