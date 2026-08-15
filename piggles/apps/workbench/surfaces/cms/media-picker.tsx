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
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Check, FolderPlus, ImageOff, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import {
  fetchAsset,
  useMediaAssets,
  useMediaLibrary,
  useUploadMedia,
  type MediaAsset,
} from './media';
import {
  useAddToCollection,
  useCreateCollection,
  useMediaCollections,
  useRemoveFromCollection,
} from './media-collections';

/** What `pick()` resolves to — enough for a field (id) AND for an in-body image
 *  (a real src to render). */
export interface PickedAsset {
  id: string;
  url: string | null;
  filename: string;
}

const MediaPickerContext = createContext<{
  pick: () => Promise<PickedAsset | null>;
  pickMany: () => Promise<PickedAsset[] | null>;
} | null>(null);

/** Open the shared picker for a SINGLE choice and await it. Must be used under a
 *  `MediaPickerProvider` — every content field is, so this never throws in
 *  practice. */
export function useMediaPicker(): () => Promise<PickedAsset | null> {
  const ctx = useContext(MediaPickerContext);
  if (!ctx) {
    throw new Error('useMediaPicker must be used within a MediaPickerProvider.');
  }
  return ctx.pick;
}

/** Open the shared picker for MANY choices at once and await them, in the order
 *  they were selected — for a carousel field where the old flow forced a
 *  one-at-a-time "pick, reopen, pick" loop. Resolves null on cancel, [] never
 *  (the confirm button is disabled with nothing selected). */
export function useMediaMultiPicker(): () => Promise<PickedAsset[] | null> {
  const ctx = useContext(MediaPickerContext);
  if (!ctx) {
    throw new Error('useMediaMultiPicker must be used within a MediaPickerProvider.');
  }
  return ctx.pickMany;
}

/** The auto-group an upload made in THIS provider belongs to (docs/49) — the surface
 *  sets it so a picture uploaded from the logo slot is Brand, from the social composer
 *  is Marketing, etc., with no filing. Absent = a plain "Uploaded" library file. */
export type MediaSource = 'brand' | 'product' | 'marketing' | 'content';

export function MediaPickerProvider({
  children,
  source,
}: {
  children: ReactNode;
  source?: MediaSource;
}) {
  const [open, setOpen] = useState(false);
  const [multiple, setMultiple] = useState(false);
  // One resolver handles both modes; `pick`/`pickMany` normalize what it settles
  // to their own promise's shape, so storing the wider union stays type-safe.
  const resolverRef = useRef<((result: PickedAsset | PickedAsset[] | null) => void) | null>(null);

  const pick = useCallback(
    () =>
      new Promise<PickedAsset | null>((resolve) => {
        resolverRef.current = (result) => {
          resolve(Array.isArray(result) ? (result[0] ?? null) : result);
        };
        setMultiple(false);
        setOpen(true);
      }),
    []
  );

  const pickMany = useCallback(
    () =>
      new Promise<PickedAsset[] | null>((resolve) => {
        resolverRef.current = (result) => {
          resolve(result == null ? null : Array.isArray(result) ? result : [result]);
        };
        setMultiple(true);
        setOpen(true);
      }),
    []
  );

  const settle = useCallback((result: PickedAsset | PickedAsset[] | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const value = useMemo(() => ({ pick, pickMany }), [pick, pickMany]);

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      {open ? (
        <MediaPickerDialog
          multiple={multiple}
          source={source}
          onResolve={(result) => {
            settle(result);
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

// The picker's automatic groups (docs/49), derived from each asset's upload `source`
// — no manual filing. `filter` is the value sent to the library query; `undefined`
// is "All", `'none'` is the "Uploaded" bucket (source IS NULL). Shown as a fixed row
// so the organization is always legible, even when a group is momentarily empty.
const MEDIA_GROUPS: { label: string; filter: string | undefined }[] = [
  { label: 'All', filter: undefined },
  { label: 'Brand', filter: 'brand' },
  { label: 'Product', filter: 'product' },
  { label: 'Marketing', filter: 'marketing' },
  { label: 'Content', filter: 'content' },
  { label: 'Uploaded', filter: 'none' },
];

function MediaPickerDialog({
  multiple,
  source,
  onResolve,
  onCancel,
}: {
  multiple: boolean;
  source?: MediaSource;
  onResolve: (result: PickedAsset | PickedAsset[]) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  // What's being browsed. A source auto-group (`group`) and a manual `collectionId`
  // are mutually exclusive selections — picking one clears the other. Independent of
  // `source`, which is where a NEW upload is FILED, not what you're looking at.
  const [group, setGroup] = useState<string | undefined>(undefined);
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined);
  const library = useMediaLibrary(search, true, group, collectionId);
  const upload = useUploadMedia(source);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Multi-select only: the running selection, kept in the order tiles were
  // tapped so a carousel publishes in the order the operator built it.
  const [selected, setSelected] = useState<PickedAsset[]>([]);

  // Collections (the manual "boards"). Loaded alongside the grid; the group row
  // lists them, and each tile's menu adds/removes membership.
  const collections = useMediaCollections();
  const createCollection = useCreateCollection();
  const addToCollection = useAddToCollection();
  const removeFromCollection = useRemoveFromCollection();
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const newCollectionRef = useRef<HTMLInputElement>(null);
  const collectionList = collections.data ?? [];
  const activeCollection = collectionList.find((c) => c.id === collectionId);

  // Focus the name field the moment the inline "New collection" input appears — the
  // user just clicked to make one, so they mean to type immediately.
  useEffect(() => {
    if (creatingCollection) newCollectionRef.current?.focus();
  }, [creatingCollection]);

  const showSource = (value: string | undefined) => {
    setGroup(value);
    setCollectionId(undefined);
  };
  const showCollection = (id: string) => {
    setCollectionId(id);
    setGroup(undefined);
  };
  const submitNewCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    createCollection.mutate(name, {
      onSuccess: (created) => {
        setCreatingCollection(false);
        setNewCollectionName('');
        showCollection(created.id);
      },
      onError: () => {
        toast.add({ title: 'Could not create that collection', type: 'error' });
      },
    });
  };
  const addAssetTo = (assetId: string, id: string, name: string) => {
    addToCollection.mutate(
      { collectionId: id, assetIds: [assetId] },
      {
        onSuccess: () => {
          toast.add({ title: `Saved to ${name}`, type: 'success' });
        },
        onError: () => {
          toast.add({ title: 'Could not save that picture', type: 'error' });
        },
      }
    );
  };
  const removeAssetFrom = (assetId: string) => {
    if (!collectionId) return;
    removeFromCollection.mutate({ collectionId, assetId });
  };

  const assets = library.data ?? [];

  // In single mode a chosen file resolves immediately; in multi mode it joins
  // the running selection so the operator can keep adding before confirming.
  const takePicked = (asset: PickedAsset) => {
    if (multiple) {
      setSelected((prev) => (prev.some((p) => p.id === asset.id) ? prev : [...prev, asset]));
    } else {
      onResolve(asset);
    }
  };

  const toggle = (asset: PickedAsset) => {
    setSelected((prev) =>
      prev.some((p) => p.id === asset.id) ? prev.filter((p) => p.id !== asset.id) : [...prev, asset]
    );
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (assetId) => {
        // Resolve the newly uploaded file's URL so it can be used straight away —
        // it is almost always the one they wanted, and an in-body image needs a
        // real src, not just an id.
        fetchAsset(assetId)
          .then((asset) => {
            takePicked({ id: asset.id, url: asset.url, filename: asset.filename });
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

  // Multi-select mode: upload a whole batch at once (the file input is `multiple`
  // there). Uploads run in parallel but are added to the running selection in the
  // FILE ORDER the operator chose — a carousel must publish in that order, so we
  // can't append as each network round-trip happens to finish. A partial failure
  // adds the ones that worked and tells the operator how many didn't.
  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const settled = await Promise.allSettled(files.map((file) => upload.mutateAsync(file)));
    const uploaded: PickedAsset[] = [];
    let failed = 0;
    for (const result of settled) {
      if (result.status !== 'fulfilled') {
        failed += 1;
        continue;
      }
      try {
        const asset = await fetchAsset(result.value);
        uploaded.push({ id: asset.id, url: asset.url, filename: asset.filename });
      } catch {
        // Uploaded to the library but its URL would not resolve — it is still
        // pickable from the grid, so count it as a soft failure for the summary.
        failed += 1;
      }
    }
    for (const asset of uploaded) takePicked(asset);
    if (failed > 0) {
      const allFailed = failed === files.length;
      toast.add({
        title: allFailed
          ? 'Could not upload those pictures'
          : `${String(failed)} of ${String(files.length)} did not upload`,
        description: allFailed
          ? 'Nothing was added. Try again in a moment.'
          : 'The rest are in your library — pick them from the grid.',
        type: allFailed ? 'error' : 'warning',
      });
    }
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
        {/* `@container` is load-bearing: a PaneScope'd dialog portals to the
            pane HOST, which sits outside the `@container` on PANE_SHELL, so the
            grid's `@md:`/`@2xl:` steps below matched nothing and the picker
            showed three columns at every width. */}
        <DialogContent className="@container flex max-h-[calc(100%-2rem)] w-full max-w-2xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>{multiple ? 'Choose pictures' : 'Choose a picture'}</DialogTitle>
            <DialogDescription>
              {multiple
                ? 'Tap as many as you want — they are added in the order you tap them. Upload a new one, or pick from your library. Nothing is saved until you save the whole page.'
                : 'Pick one from your library, or upload a new one. Your choice is not saved until you save the whole page.'}
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
              // Match the picker's mode: multi-select lets you upload a whole
              // batch at once, single stays one file.
              multiple={multiple}
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (multiple) void onFiles(files);
                else onFile(files[0]);
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

          {/* Groups: automatic (source, docs/49) + manual collections + a make-new.
              A source group and a collection are mutually exclusive selections. */}
          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Picture groups"
          >
            {MEDIA_GROUPS.map((g) => {
              const active = !collectionId && group === g.filter;
              return (
                <Button
                  key={g.label}
                  size="sm"
                  role="tab"
                  aria-selected={active}
                  variant={active ? 'soft' : 'ghost'}
                  color={active ? 'module' : 'neutral'}
                  onClick={() => {
                    showSource(g.filter);
                  }}
                >
                  {g.label}
                </Button>
              );
            })}

            {collectionList.length > 0 ? (
              <span className="bg-base-300 mx-1 h-5 w-px" aria-hidden />
            ) : null}
            {collectionList.map((c) => {
              const active = collectionId === c.id;
              return (
                <Button
                  key={c.id}
                  size="sm"
                  role="tab"
                  aria-selected={active}
                  variant={active ? 'soft' : 'ghost'}
                  color={active ? 'module' : 'neutral'}
                  onClick={() => {
                    showCollection(c.id);
                  }}
                >
                  {c.name}
                  <span className="opacity-60">{c.itemCount}</span>
                </Button>
              );
            })}

            {creatingCollection ? (
              <Input
                ref={newCollectionRef}
                size="sm"
                color="module"
                className="w-40"
                placeholder="Collection name…"
                value={newCollectionName}
                onChange={(event) => {
                  setNewCollectionName(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitNewCollection();
                  if (event.key === 'Escape') {
                    setCreatingCollection(false);
                    setNewCollectionName('');
                  }
                }}
                onBlur={() => {
                  if (!newCollectionName.trim()) setCreatingCollection(false);
                }}
              />
            ) : (
              <Button
                size="sm"
                variant="ghost"
                color="neutral"
                onClick={() => {
                  setCreatingCollection(true);
                }}
              >
                <FolderPlus className="size-4" aria-hidden />
                New collection
              </Button>
            )}
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
              <PaneWaiting label="Loading your pictures…" />
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center gap-1 p-8 text-center">
                <ImageOff className="size-6" aria-hidden />
                <Text>
                  {search
                    ? `No pictures match “${search.trim()}”.`
                    : activeCollection
                      ? `“${activeCollection.name}” is empty — save pictures to it with the folder button on each one.`
                      : group
                        ? 'No pictures in this group yet.'
                        : 'No pictures yet — upload one to get started.'}
                </Text>
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-5">
                {assets.map((asset) => {
                  const picked: PickedAsset = {
                    id: asset.id,
                    url: asset.url,
                    filename: asset.filename,
                  };
                  const order = multiple ? selected.findIndex((p) => p.id === asset.id) : -1;
                  const isSelected = order >= 0;
                  return (
                    <li key={asset.id} className="relative">
                      <button
                        type="button"
                        aria-label={
                          multiple
                            ? `${isSelected ? 'Remove' : 'Add'} ${asset.filename}`
                            : `Choose ${asset.filename}`
                        }
                        aria-pressed={multiple ? isSelected : undefined}
                        className={`bg-base-200 rounded-box relative aspect-square w-full overflow-hidden ${
                          isSelected ? 'ring-module ring-2' : ''
                        }`}
                        onClick={() => {
                          if (multiple) toggle(picked);
                          else onResolve(picked);
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
                        {isSelected ? (
                          <span
                            className="bg-module text-module-content absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-xs font-semibold"
                            aria-hidden
                          >
                            {order + 1}
                          </span>
                        ) : null}
                      </button>

                      {/* Save-to-collection menu — a SIBLING of the pick button (not
                          nested: a button in a button is invalid), so opening it never
                          picks the tile. The "board" a picture goes on. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            size="xs"
                            shape="square"
                            variant="soft"
                            color="neutral"
                            className="absolute top-1 left-1"
                            aria-label={`Save ${asset.filename} to a collection`}
                          >
                            <FolderPlus className="size-3.5" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {activeCollection ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  removeAssetFrom(asset.id);
                                }}
                              >
                                <Trash2 className="size-4" aria-hidden />
                                Remove from {activeCollection.name}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}
                          <DropdownMenuLabel>Save to collection</DropdownMenuLabel>
                          {collectionList.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No collections yet — make one above
                            </DropdownMenuItem>
                          ) : (
                            collectionList.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => {
                                  addAssetTo(asset.id, c.id, c.name);
                                }}
                              >
                                {c.name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            {multiple ? (
              <>
                <Text className="mr-auto text-sm">
                  {selected.length > 0 ? `${selected.length} selected` : 'Nothing selected yet'}
                </Text>
                <Button size="sm" variant="ghost" color="neutral" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="module"
                  disabled={selected.length === 0}
                  onClick={() => {
                    onResolve(selected);
                  }}
                >
                  <Check className="size-4" aria-hidden />
                  {selected.length === 1 ? 'Add 1 picture' : `Add ${selected.length} pictures`}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" color="neutral" onClick={onCancel}>
                Cancel
              </Button>
            )}
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
  const pickMany = useMediaMultiPicker();
  const ids = useMemo(() => asIds(value, multiple), [value, multiple]);
  const assetsQuery = useMediaAssets(ids);

  const assetById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const asset of assetsQuery.data ?? []) map.set(asset.id, asset);
    return map;
  }, [assetsQuery.data]);

  const choose = async () => {
    if (multiple) {
      // Multi-select: pick a whole batch at once, appended in tap order, and drop
      // any already on the field so re-opening never duplicates.
      const picked = await pickMany();
      if (!picked) return;
      const additions = picked.map((p) => p.id).filter((id) => !ids.includes(id));
      if (additions.length > 0) onChange([...ids, ...additions]);
    } else {
      const picked = await pick();
      if (!picked) return;
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
