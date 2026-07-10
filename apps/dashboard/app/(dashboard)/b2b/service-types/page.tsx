import { Calendar } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { ServiceTypesList } from './_components/service-types-list';
import { NewServiceTypeButton } from './_components/new-service-type-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
  createdAt: string;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export default async function ServiceTypesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, result] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ServiceType[]>(
      `/v1/b2b/service-types?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const types = result.data;
  const total = (result.meta?.total as number | undefined) ?? types.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Service Types"
          description="Define the types of service your team offers for B2B account appointments."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar enableViewToggle searchable={false} primaryAction={<NewServiceTypeButton />} />
      }
      pager={<ListPager total={total} />}
    >
      {types.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No service types yet"
              description="Add your first service type so B2B accounts can book appointments."
              actions={<NewServiceTypeButton />}
            />
          </CardBody>
        </Card>
      ) : (
        <ServiceTypesList types={types} view={view} />
      )}
    </ListPageShell>
  );
}
