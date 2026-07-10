export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { NewSourceButton } from './_components/new-source-button';
import { SourcesList } from './_components/sources-list';

export const metadata: Metadata = { title: 'Inventory Sources' };

interface InventorySource {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, string>;
  lastSyncAt: string | null;
  syncIntervalSec: number;
  notes: string | null;
  createdAt: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InventorySourcesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const [{ data: sources, meta }, prefs] = await Promise.all([
    api.getPaged<InventorySource[]>(
      `/v1/inventory/sources?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
    getUserPreferences(),
  ]);
  const total = (meta?.total as number | undefined) ?? sources.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Database className="h-5 w-5" />}
          title="Sources"
          badge={
            <Badge color="neutral" variant="soft">
              {total} source{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="Inventory feeds that push stock counts into sparx."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search sources…"
          enableViewToggle
          primaryAction={<NewSourceButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {sources.length === 0 ? (
        <Card>
          <EmptyState
            title="No inventory sources connected"
            description="Connect a CSV feed or API source to sync stock levels."
            actions={<NewSourceButton />}
          />
        </Card>
      ) : (
        <SourcesList sources={sources} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
