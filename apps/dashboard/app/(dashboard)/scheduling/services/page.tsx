export const dynamic = 'force-dynamic';

import { Briefcase } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { SchedulingService } from '../_lib/types';
import { NewServiceButton } from './_components/new-service-button';
import { ServicesList } from './_components/services-list';

export default async function SchedulingServicesPage() {
  const services = await api
    .get<SchedulingService[]>('/v1/scheduling/services')
    .catch(() => [] as SchedulingService[]);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Briefcase className="h-5 w-5" />}
          title="Services"
          badge={
            <Badge color="module" variant="soft">
              {services.length} service{services.length !== 1 ? 's' : ''}
            </Badge>
          }
          description="What customers can book — appointments, classes, reservations, and rentals."
          actions={<NewServiceButton />}
        />

        {services.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No services yet"
              description="Create your first bookable service to start taking bookings."
              action={<NewServiceButton />}
            />
          </Card>
        ) : (
          <Card padding="none">
            <ServicesList services={services} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
