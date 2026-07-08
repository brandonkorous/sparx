import { PageHeader, statusLabel, statusTone } from '@sparx/ui';
import { Badge, Card, CardActions, CardBody, CardTitle, EmptyState } from 'silicaui-react';
import { Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { EntityRowLink } from '../../_components/entity-row-link';
import { UploadButton } from './upload-button';

export const dynamic = 'force-dynamic';

interface MediaAsset {
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

export default async function MediaPage() {
  const assets = await api.get<MediaAsset[]>('/v1/media/assets?limit=100');

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<ImageIcon className="h-5 w-5" />}
          title="Media library"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {assets.length}
            </Badge>
          }
          description="Images, video, and other files used across your pages and posts."
          actions={<UploadButton />}
        />

        {assets.length === 100 && (
          <p className="text-base-content/70 text-xs" role="note">
            Showing the 100 most recently updated assets. Search + sort + cursor pagination land in
            a follow-up — until then, upload-sort / filter via the API or the assets pane on the
            content entry that uses each one.
          </p>
        )}

        {assets.length === 0 ? (
          <Card className="bg-module bg-soft">
            <EmptyState
              icon={<ImageIcon className="h-5 w-5" />}
              title="No media yet"
              description="Upload your first image to start using it in pages and posts."
              actions={<UploadButton />}
            />
          </Card>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill,minmax(min(14rem,100%),1fr))',
            }}
          >
            {assets.map((a) => (
              <MediaCard key={a.id} asset={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaCard({ asset }: { asset: MediaAsset }) {
  // Prefer the smallest WebP variant for the thumbnail; fall back to the
  // original (LocalStorage mode where no variants exist).
  const thumb =
    asset.variants.find((v) => v.format === 'webp')?.url ??
    asset.variants[0]?.url ??
    asset.original_url ??
    null;
  const isImage = asset.mime_type.startsWith('image/');

  return (
    <Card>
      <EntityRowLink
        href={`/cms/media/${asset.id}`}
        entityType="media"
        entityId={asset.id}
        className="block"
      >
        <div
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-[var(--color-bg-subtle)]"
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
            <ImageIcon className="h-10 w-10 text-[var(--color-text-muted)]" />
          )}
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
      </EntityRowLink>
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
          <Badge color={asset.usage_count > 0 ? 'success' : 'neutral'} variant="soft" size="sm">
            {asset.usage_count > 0 ? `Used ${asset.usage_count}×` : 'Unused'}
          </Badge>
          <p className="text-base-content/70 ml-auto text-xs">
            {formatBytes(Number(asset.byte_size))}
          </p>
        </div>
      </CardActions>
    </Card>
  );
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
