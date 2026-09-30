'use client';

// A reusable "pick a picture" field: a category's icon or hero, a collection's
// hero. One component, not three near-copies. The picker is a modal because its
// result commits to the pane's own draft, never the server.

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Button, Text } from '@wizeworks/silicaui-react';
import { faImageSlash, faImages, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useMediaAssets, type MediaAsset } from './products-data';
import { MediaPickerDialog } from './media-field-picker';

interface MediaFieldProps {
  label: string;
  description: string;
  /** The chosen media asset id, or null for none. */
  value: string | null;
  onChange: (mediaId: string | null) => void;
}

export function MediaField({ label, description, value, onChange }: MediaFieldProps) {
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
        <ChosenPreview asset={value ? asset : null} />
        <FieldActions
          hasValue={value !== null}
          onChoose={() => {
            setOpen(true);
          }}
          onRemove={() => {
            onChange(null);
          }}
        />
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

/** The chosen picture, or an empty tile when there is none. */
function ChosenPreview({ asset }: { asset: MediaAsset | null }) {
  return (
    <div className="border-base-300 bg-base-200 rounded-box relative size-20 shrink-0 overflow-hidden border">
      {asset?.url ? (
        <Image
          src={asset.url}
          // The owner's description first. The filename is a console-only fallback
          // naming which file is chosen; it is never published.
          alt={asset.altText ?? asset.filename}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized={!asset.canOptimize || asset.mimeType === 'image/gif'}
        />
      ) : (
        <span className="flex h-full items-center justify-center">
          <Icon glyph={faImageSlash} className="size-5" aria-hidden />
        </span>
      )}
    </div>
  );
}

function FieldActions({
  hasValue,
  onChoose,
  onRemove,
}: {
  hasValue: boolean;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" color="module" onClick={onChoose}>
        <Icon glyph={faImages} className="size-4" aria-hidden />
        {hasValue ? 'Change picture' : 'Choose a picture'}
      </Button>
      {hasValue ? (
        <Button size="sm" variant="ghost" color="danger" onClick={onRemove}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Remove
        </Button>
      ) : null}
    </div>
  );
}
