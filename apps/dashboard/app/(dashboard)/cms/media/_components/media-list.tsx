'use client';

import { Badge, Card, CardActions, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import {
  type BulkAction,
  Checkbox,
  cn,
  SelectionList,
  type SelectionColumn,
  statusLabel,
  statusTone,
  toast,
} from '@sparx/ui';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { deleteAsset } from '../actions';

// Media library table/grid — selection + bulk delete on top of the shared
// `SelectionList` dual-view substrate (docs/34 §7), matching every other CMS
// list. Card view keeps the library's distinctive image-forward layout via
// `card.render` (SelectionList's escape hatch) rather than the generic
// text-first card shape — a thumbnail-forward grid is the right call for an
// asset library, same as the rest of the platform's card/table convention.

export interface MediaAsset {
  id: string;
  key: string;
  original_filename: string;
  mime_type: string;
  byte_size: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominant_color: string | null;
  status: string;
  alt_text: string | null;
  usage_count: number;
  variants: { id: string; format: string; width: number; url: string }[];
  original_url: string | null;
  updated_at: string;
}

interface MediaListProps {
  assets: MediaAsset[];
  view: 'table' | 'card';
}

function pickThumb(asset: MediaAsset): string | null {
  return (
    asset.variants.find((v) => v.format === 'webp')?.url ??
    asset.variants[0]?.url ??
    asset.original_url ??
    null
  );
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Thumb({
  asset,
  className,
  iconSize = 'sm',
}: {
  asset: MediaAsset;
  className?: string;
  iconSize?: 'sm' | 'lg';
}) {
  const thumb = pickThumb(asset);
  const isImage = asset.mime_type.startsWith('image/');
  return (
    <div
      className={cn(
        'bg-base-200 relative flex shrink-0 items-center justify-center overflow-hidden',
        className
      )}
      style={asset.dominant_color ? { backgroundColor: asset.dominant_color } : undefined}
    >
      {isImage && thumb ? (
        <img
          src={thumb}
          alt={asset.alt_text ?? asset.original_filename}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon
          className={cn('text-base-content/60', iconSize === 'lg' ? 'h-10 w-10' : 'h-4 w-4')}
        />
      )}
    </div>
  );
}

function usageBadge(asset: MediaAsset) {
  return (
    <Badge color={asset.usage_count > 0 ? 'success' : 'neutral'} variant="soft" size="sm">
      {asset.usage_count > 0 ? `Used ${asset.usage_count}×` : 'Unused'}
    </Badge>
  );
}

function MediaCard({
  asset,
  selected,
  onToggle,
}: {
  asset: MediaAsset;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <div className="relative">
        <EntityRowLink
          href={`/cms/media/${asset.id}`}
          entityType="media"
          entityId={asset.id}
          className="block"
        >
          <Thumb asset={asset} className="aspect-square w-full" iconSize="lg" />
        </EntityRowLink>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${asset.original_filename}`}
          className="bg-base-100/90 absolute top-2 left-2 rounded"
        />
        {asset.status !== 'ready' && (
          <Badge
            color={statusTone(asset.status)}
            variant="soft"
            size="sm"
            className="absolute top-2 right-2"
          >
            {statusLabel(asset.status)}
          </Badge>
        )}
      </div>
      <CardBody>
        <CardTitle className="truncate text-sm">{asset.original_filename}</CardTitle>
        <p className="opacity-70">
          {asset.width && asset.height
            ? `${asset.width}×${asset.height}`
            : asset.mime_type.split('/')[1]?.toUpperCase()}
        </p>
      </CardBody>
      <CardActions className="justify-start">
        <div className="flex w-full flex-row items-center gap-2">
          {usageBadge(asset)}
          <p className="text-base-content/70 ml-auto text-xs">
            {formatBytes(Number(asset.byte_size))}
          </p>
        </div>
      </CardActions>
    </Card>
  );
}

export function MediaList({ assets, view }: MediaListProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} asset(s)? Assets still referenced by a page or post can’t be deleted — those will be skipped.',
      onAction: async (ids) => {
        const results = await Promise.all(ids.map((id) => deleteAsset(id)));
        const failed = results.filter((r) => !r.ok).length;
        const succeeded = ids.length - failed;
        if (failed > 0) {
          toast.error(
            succeeded > 0
              ? `Deleted ${succeeded} of ${ids.length} — the rest are still in use`
              : `Couldn’t delete ${failed} of ${ids.length} asset${ids.length === 1 ? '' : 's'} — still in use`
          );
          return;
        }
        toast.success(ids.length === 1 ? 'Asset deleted' : `${ids.length} assets deleted`);
      },
    },
  ];

  const columns: SelectionColumn<MediaAsset>[] = [
    {
      header: 'Preview',
      cell: (a) => <Thumb asset={a} className="h-10 w-10 rounded-md" />,
    },
    {
      header: 'File',
      cell: (a) => (
        <div className="flex flex-col gap-1">
          <EntityRowLink
            href={`/cms/media/${a.id}`}
            entityType="media"
            entityId={a.id}
            className="hover:text-module max-w-[24rem] truncate text-sm font-medium hover:underline"
          >
            {a.original_filename}
          </EntityRowLink>
          <p className="text-base-content/70 text-xs">
            {a.width && a.height ? `${a.width}×${a.height}` : a.mime_type}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (a) =>
        a.status !== 'ready' ? (
          <Badge color={statusTone(a.status)} variant="soft" size="sm">
            {statusLabel(a.status)}
          </Badge>
        ) : (
          <p className="text-base-content/50 text-sm">—</p>
        ),
    },
    { header: 'Usage', cell: usageBadge },
    {
      header: 'Size',
      align: 'right',
      cell: (a) => <p className="text-sm tabular-nums">{formatBytes(Number(a.byte_size))}</p>,
    },
    {
      header: 'Updated',
      cell: (a) => (
        <p className="text-base-content/70 text-sm">
          {new Date(a.updated_at).toLocaleDateString()}
        </p>
      ),
    },
  ];

  return (
    <SelectionList
      items={assets}
      view={view}
      getId={(a) => a.id}
      getRowLabel={(a) => a.original_filename}
      entityLabelPlural="assets"
      columns={columns}
      card={{
        // `title` is unused — `render` fully owns card output — but
        // `SelectionCard` requires it regardless of `render` being set.
        title: (a) => a.original_filename,
        render: (a, ctx) => (
          <MediaCard key={a.id} asset={a} selected={ctx.selected} onToggle={ctx.toggle} />
        ),
      }}
      bulkActions={bulkActions}
    />
  );
}
