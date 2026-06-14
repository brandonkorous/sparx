import { Calendar } from 'lucide-react';

import { Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
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

  const [prefs, result] = await Promise.all([
    getUserPreferences(),
    api.get<{ types: ServiceType[] }>('/v1/b2b/service-types'),
  ]);
  const types = result.types ?? [];

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Service Types"
          description="Define the types of service your team offers for B2B account appointments."
          actions={<NewServiceTypeButton />}
        />

        <ListToolbar enableViewToggle searchable={false} />

        {types.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No service types yet"
              description="Add your first service type so B2B accounts can book appointments."
              action={<NewServiceTypeButton />}
            />
          </Card>
        ) : (
          <ServiceTypesList types={types} view={view} />
        )}
      </Stack>
    </Container>
  );
}
