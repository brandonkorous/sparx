export const dynamic = 'force-dynamic';

import { Clock } from 'lucide-react';
import { Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { AvailabilityException, AvailabilityWindow, SchedulingResource } from '../_lib/types';
import { ResourcePicker } from './_components/resource-picker';
import { WeeklyEditor } from './_components/weekly-editor';
import { ExceptionsPanel } from './_components/exceptions-panel';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingAvailabilityPage({ searchParams }: Props) {
  const params = await searchParams;
  const resources = await api
    .get<SchedulingResource[]>('/v1/scheduling/resources')
    .catch(() => [] as SchedulingResource[]);

  const requested = typeof params.resource === 'string' ? params.resource : undefined;
  const selected = resources.find((r) => r.id === requested) ?? resources[0];

  const [windows, exceptions] = selected
    ? await Promise.all([
        api
          .get<AvailabilityWindow[]>(`/v1/scheduling/resources/${selected.id}/availability`)
          .catch(() => [] as AvailabilityWindow[]),
        api
          .get<AvailabilityException[]>(`/v1/scheduling/exceptions?resourceId=${selected.id}`)
          .catch(() => [] as AvailabilityException[]),
      ])
    : [[], []];

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Clock className="h-5 w-5" />}
          title="Availability"
          description="Set each resource's weekly hours and any time off — the booking engine offers only slots that fit."
        />

        {resources.length === 0 || !selected ? (
          <Card padding="none">
            <EmptyState
              title="No resources yet"
              description="Add a resource first, then set when it's available."
            />
          </Card>
        ) : (
          <Stack gap={5}>
            <ResourcePicker resources={resources} selectedId={selected.id} />
            <WeeklyEditor resourceId={selected.id} initialWindows={windows} />
            <ExceptionsPanel resourceId={selected.id} exceptions={exceptions} />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
