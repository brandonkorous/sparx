export const dynamic = 'force-dynamic';

import { Users } from 'lucide-react';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { SchedulingResource } from '../_lib/types';
import { RESOURCE_KIND_LABEL } from '../_lib/format';
import { NewResourceButton } from './_components/new-resource-button';
import { ResourcesList } from './_components/resources-list';

// Resources index — a standard docs/34 List surface: a ListToolbar with search
// + kind/status filters + a Table/Cards toggle on top of the shared SelectionList.

const KIND_OPTIONS = Object.entries(RESOURCE_KIND_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_OPTIONS = [{ value: 'active', label: 'Active only' }];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingResourcesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const kind = stringParam(params.kind);
  const status = stringParam(params.status);

  const [prefs, { data: resources, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SchedulingResource[]>(
      `/v1/scheduling/resources?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(kind ? { kind } : {}),
        ...(status === 'active' ? { activeOnly: 'true' } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? resources.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Users className="h-5 w-5" />}
          title="Resources"
          badge={
            <Badge color="module" variant="soft">
              {total} resource{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="Staff, assets, tables, spaces, and equipment whose time a booking consumes."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or description…"
          filters={[
            { key: 'kind', label: 'Types', options: KIND_OPTIONS },
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          ]}
          enableViewToggle
          primaryAction={<NewResourceButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {resources.length === 0 ? (
        <Card>
          <EmptyState
            title={q || kind || status ? 'No resources match these filters' : 'No resources yet'}
            description={
              q || kind || status
                ? 'Adjust filters or clear the search to broaden the results.'
                : 'Add staff, tables, or equipment so services have something to book against.'
            }
            actions={q || kind || status ? undefined : <NewResourceButton />}
          />
        </Card>
      ) : (
        <ResourcesList resources={resources} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
