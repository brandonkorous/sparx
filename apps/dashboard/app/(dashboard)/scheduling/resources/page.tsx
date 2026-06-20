export const dynamic = 'force-dynamic';

import { Users } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { SchedulingResource } from '../_lib/types';
import { NewResourceButton } from './_components/new-resource-button';
import { ResourcesList } from './_components/resources-list';

export default async function SchedulingResourcesPage() {
  const resources = await api
    .get<SchedulingResource[]>('/v1/scheduling/resources')
    .catch(() => [] as SchedulingResource[]);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Users className="h-5 w-5" />}
          title="Resources"
          badge={
            <Badge color="module" variant="soft">
              {resources.length} resource{resources.length !== 1 ? 's' : ''}
            </Badge>
          }
          description="Staff, assets, tables, spaces, and equipment whose time a booking consumes."
          actions={<NewResourceButton />}
        />

        {resources.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No resources yet"
              description="Add staff, tables, or equipment so services have something to book against."
              action={<NewResourceButton />}
            />
          </Card>
        ) : (
          <Card padding="none">
            <ResourcesList resources={resources} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
