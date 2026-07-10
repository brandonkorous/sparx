import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { UploadButton } from './upload-button';
import { MediaList, type MediaAsset } from './_components/media-list';

// Media library index — a standard Collection/List surface (docs/34 §7): a
// ListToolbar with search + status/type filters + a Table/Cards toggle
// honoring the user's defaultListView, same as every other CMS list. Card
// view keeps the library's thumbnail-forward layout (see media-list.tsx);
// the table mirrors its key fields for dense scanning.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'ready', label: 'Ready' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'failed', label: 'Failed' },
];

const TYPE_OPTIONS = [
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'application', label: 'Documents' },
];

export default async function MediaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const status = stringParam(params.status);
  const type = stringParam(params.type);

  const [prefs, { data: assets, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<MediaAsset[]>(
      `/v1/media/assets?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? assets.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<ImageIcon className="h-5 w-5" />}
          title="Media library"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="Images, video, and other files used across your pages and posts."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search filename, alt text, or caption…"
          filters={[
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
            { key: 'type', label: 'Types', options: TYPE_OPTIONS },
          ]}
          enableViewToggle
          primaryAction={<UploadButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {assets.length === 0 ? (
        <Card className="bg-module bg-soft">
          <EmptyState
            icon={<ImageIcon className="h-5 w-5" />}
            title={total === 0 ? 'No media yet' : 'No media match these filters'}
            description={
              total === 0
                ? 'Upload your first image to start using it in pages and posts.'
                : 'Adjust filters or clear the search to broaden the results.'
            }
            actions={total === 0 ? <UploadButton /> : undefined}
          />
        </Card>
      ) : (
        <MediaList assets={assets} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
