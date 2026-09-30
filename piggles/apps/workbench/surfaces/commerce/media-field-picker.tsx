'use client';

// The "Choose a picture" dialog behind MediaField: search the library, upload a
// new picture, or pick one. The choice lands on the pane's draft, not the server.

import { useRef, useState } from 'react';
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
import { faImageSlash, faUpload } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useUploadMedia, type MediaAsset } from './products-data';
import { useMediaLibrary } from './media-field-library';

export function MediaPickerDialog({
  selected,
  onClose,
  onPick,
}: {
  selected: string | null;
  onClose: () => void;
  onPick: (mediaId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const library = useMediaLibrary(search, true);

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
        {/* `@container` is load-bearing: the dialog portals outside PANE_SHELL's
            container, so without it the grid steps below match nothing. */}
        <DialogContent className="@container flex max-h-[calc(100%-2rem)] w-full max-w-2xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Choose a picture</DialogTitle>
            <DialogDescription>
              Pick one from your library, or upload a new one. Your choice is not saved until you
              save the whole form.
            </DialogDescription>
          </div>
          <PickerToolbar search={search} onSearch={setSearch} onUploaded={onPick} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LibraryBody library={library} search={search} selected={selected} onPick={onPick} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/** Search, plus Upload. A new upload is picked straight away: it is almost
 *  always the one they wanted. */
function PickerToolbar({
  search,
  onSearch,
  onUploaded,
}: {
  search: string;
  onSearch: (next: string) => void;
  onUploaded: (mediaId: string) => void;
}) {
  const { upload, fileRef, onFile } = usePickerUpload(onUploaded);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="max-w-xs min-w-0 flex-1">
        <SearchInput
          size="sm"
          aria-label="Search your pictures"
          placeholder="Search your pictures…"
          value={search}
          onValueChange={onSearch}
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
        <Icon glyph={faUpload} className="size-4" aria-hidden />
        Upload
      </Button>
    </div>
  );
}

/** Uploads one chosen file and hands its id on; a failure is a toast. */
function usePickerUpload(onUploaded: (mediaId: string) => void) {
  const toast = useToast();
  const upload = useUploadMedia();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (mediaId) => {
        onUploaded(mediaId);
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
  return { upload, fileRef, onFile };
}

/** The library's four states: failed, loading, empty, or the grid. */
function LibraryBody({
  library,
  search,
  selected,
  onPick,
}: {
  library: ReturnType<typeof useMediaLibrary>;
  search: string;
  selected: string | null;
  onPick: (mediaId: string) => void;
}) {
  const assets = library.data ?? [];
  if (library.isError) {
    return (
      <LibraryFailed
        onRetry={() => {
          void library.refetch();
        }}
      />
    );
  }
  if (library.isPending) return <PaneWaiting label="Loading your pictures…" />;
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 p-8 text-center">
        <Icon glyph={faImageSlash} className="size-6" aria-hidden />
        <Text>
          {search
            ? `No pictures match “${search.trim()}”.`
            : 'No pictures yet. Upload one to get started.'}
        </Text>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-5">
      {assets.map((asset) => (
        <li key={asset.id}>
          <LibraryTile asset={asset} selected={selected === asset.id} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function LibraryFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <Text>Your library could not be loaded just now.</Text>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function LibraryTile({
  asset,
  selected,
  onPick,
}: {
  asset: MediaAsset;
  selected: boolean;
  onPick: (mediaId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Choose ${asset.filename}`}
      className={`bg-base-200 rounded-box relative aspect-square w-full overflow-hidden ${
        selected ? 'ring-2 ring-[color:var(--color-module)] ring-offset-2' : ''
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
          <Icon glyph={faImageSlash} className="size-4" aria-hidden />
        </span>
      )}
    </button>
  );
}
