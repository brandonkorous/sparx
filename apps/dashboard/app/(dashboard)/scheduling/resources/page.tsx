export const dynamic = 'force-dynamic';

import { Users } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { SchedulingResource } from '../_lib/types';
import { NewResourceButton } from './_components/new-resource-button';
import { ResourcesList } from './_components/resources-list';

export default async function SchedulingResourcesPage() {
  const resources = await api
    .get<SchedulingResource[]>('/v1/scheduling/resources')
    .catch(() => [] as SchedulingResource[]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
          <Card>
            <CardBody className="p-0">
              <EmptyState
                title="No resources yet"
                description="Add staff, tables, or equipment so services have something to book against."
                actions={<NewResourceButton />}
              />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-0">
              <ResourcesList resources={resources} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
