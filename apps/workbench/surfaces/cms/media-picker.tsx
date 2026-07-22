'use client';

// The media picker — one browser, shared by asset fields AND in-body images.
//
// ── Why a modal, and why it's allowed ──────────────────────────────────────
//
// A media browser clears the pane-vs-modal bar twice over: it is pick-one and
// over in seconds with nothing durable to return to, AND its result commits to
// the PANE'S OWN DRAFT (an asset field, or the rich-text document) rather than
// the server — the same sanctioned exemption the invoice line-editor uses. The
// pane stays dirty on its behalf and nothing is lost if it's dismissed.
//
// ── Why it's imperative ────────────────────────────────────────────────────
//
// The rich-text editor asks for pictures through a `pickImage(): Promise<…>`
// callback, and an asset field asks by awaiting a choice. Both want the SAME
// browser, so it is mounted ONCE per editor via `MediaPickerProvider` and handed
// out as an async `pick()` through context — no second dialog, no duplicated
// upload flow.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
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
import { ImageOff, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import {
  fetchAsset,
  useMediaAssets,
  useMediaLibrary,
  useUploadMedia,
  type MediaAsset,
} from './media';

/** What `pick()` resolves to — enough for a field (id) AND for an in-body image
 *  (a real src to render). */
export interface PickedAsset {
  id: string;
  url: string | null;
  filename: string;
}

const MediaPickerContext = createContext<{ pick: () => Promise<PickedAsset | null> } | null>(null);

/** Open the shared picker and await a choice. Must be used under a
 *  `MediaPickerProvider` — every content field is, so this never throws in
 *  practice. */
export function useMediaPicker(): () => Promise<PickedAsset | null> {
  const ctx = useContext(MediaPickerContext);
  if (!ctx) {
    throw new Error('useMediaPicker must be used within a MediaPickerProvider.');
  }
  return ctx.pick;
}

export function MediaPickerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((asset: PickedAsset | null) => void) | null>(null);

  const pick = useCallback(
    () =>
      new Promise<PickedAsset | null>((resolve) => {
        resolverRef.current = resolve;
        setOpen(true);
      }),
    []
  );

  const settle = useCallback((asset: PickedAsset | null) => {
    resolverRef.current?.(asset);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ pick }), [pick]);

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      {open ? (
        <MediaPickerDialog
          onPick={(asset) => {
            settle(asset);
          }}
          onCancel={() => {
            settle(null);
          }}
        />
      ) : null}
    </MediaPickerContext.Provider>
  );
}

/* ── The browser dialog ─────────────────────────────────────────────────── */

function MediaPickerDialog({
  onPick,
  onCancel,
}: {
  onPick: (asset: PickedAsset) => void;
  onCancel: () => void;
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
      onSuccess: (assetId) => {
        // Resolve the newly uploaded file's URL so it can be inserted straight
        // away — it is almost always the one they wanted, and an in-body image
        // needs a real src, not just an id.
        fetchAsset(assetId)
          .then((asset) => {
            onPick({ id: asset.id, url: asset.url, filename: asset.filename });
          })
          .catch(() => {
            toast.add({
              title: 'Uploaded, but could not open it',
              description: 'It is in your library — pick it from the grid.',
              type: 'warning',
            });
          });
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
    // PaneScope portals the dialog into the pane that opened it, so choosing a
    // picture on one docked entry does not black out the pane beside it.
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next: boolean) => {
          if (!next) onCancel();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] w-full max-w-2xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Choose a picture</DialogTitle>
            <DialogDescription>
              Pick one from your library, or upload a new one. Your choice is not saved until you
              save the whole page.
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
                      aria-label={`Choose ${asset.filename}`}
                      className="bg-base-200 rounded-box relative aspect-square w-full overflow-hidden"
                      onClick={() => {
                        onPick({ id: asset.id, url: asset.url, filename: asset.filename });
                      }}
                    >
                      {asset.url ? (
                        <Image
                          src={asset.url}
                          alt=""
                          fill
                          sizes="160px"
                          className="object-cover"
                          // Rendered unoptimized: these are small thumbnails of
                          // CROSS-ORIGIN tenant media, where the image optimizer's
                          // host allow-list is environment-fragile (and rejects a
                          // legitimately-served original outright) — a broken tile
                          // plus a console error is worse than the browser scaling
                          // an already-small file. Same reason `next/image`'s host
                          // check is a correctness risk for stranger-CDN assets.
                          unoptimized
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
            <Button size="sm" variant="ghost" color="neutral" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/* ── The asset field control ────────────────────────────────────────────── */

function asIds(value: unknown, multiple: boolean): string[] {
  if (multiple) {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  }
  return typeof value === 'string' && value !== '' ? [value] : [];
}

/** One picture tile with a remove control. */
function AssetTile({
  asset,
  fallbackId,
  onRemove,
}: {
  asset: MediaAsset | undefined;
  fallbackId: string;
  onRemove: () => void;
}) {
  return (
    <div className="border-base-300 bg-base-200 rounded-box relative size-20 shrink-0 overflow-hidden border">
      {asset?.url ? (
        <Image
          src={asset.url}
          alt={asset.filename}
          fill
          sizes="80px"
          className="object-cover"
          // Unoptimized — see the picker grid note: cross-origin tenant thumbnail.
          unoptimized
        />
      ) : (
        <span className="flex h-full items-center justify-center">
          <ImageOff className="size-5" aria-hidden />
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove ${asset?.filename ?? fallbackId}`}
        title="Remove this picture"
        className="bg-base-100/90 hover:bg-base-100 absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-full"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * The control a schema `asset` field renders: real thumbnails + a picker, never
 * a raw id string. Handles single and multiple.
 */
export function AssetField({
  value,
  onChange,
  multiple = false,
  disabled,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const pick = useMediaPicker();
  const ids = useMemo(() => asIds(value, multiple), [value, multiple]);
  const assetsQuery = useMediaAssets(ids);

  const assetById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assetsQuery.data ?? []) map.set(asset.id, asset);
    return map;
  }, [assetsQuery.data]);

  const choose = async () => {
    const picked = await pick();
    if (!picked) return;
    if (multiple) {
      if (!ids.includes(picked.id)) onChange([...ids, picked.id]);
    } else {
      onChange(picked.id);
    }
  };

  const removeAt = (id: string) => {
    if (multiple) {
      const next = ids.filter((existing) => existing !== id);
      onChange(next.length > 0 ? next : undefined);
    } else {
      onChange(undefined);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {ids.map((id) => (
        <AssetTile
          key={id}
          asset={assetById.get(id)}
          fallbackId={id}
          onRemove={() => {
            removeAt(id);
          }}
        />
      ))}

      {ids.length === 0 || multiple ? (
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={disabled}
          onClick={() => {
            void choose();
          }}
        >
          {ids.length === 0 ? (
            <ImagePlus className="size-4" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {ids.length === 0 ? 'Choose a picture' : 'Add another'}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={disabled}
          onClick={() => {
            void choose();
          }}
        >
          <ImagePlus className="size-4" aria-hidden />
          Change picture
        </Button>
      )}
    </div>
  );
}
