export const dynamic = 'force-dynamic';

import { Repeat } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { BookingSeriesSummary } from '../_lib/types';
import { SeriesList } from './_components/series-list';

export default async function SchedulingSeriesPage() {
  const series = await api
    .get<BookingSeriesSummary[]>('/v1/scheduling/series')
    .catch(() => [] as BookingSeriesSummary[]);

  const active = series.filter((s) => s.status === 'active').length;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Repeat className="h-5 w-5" />}
          title="Recurring"
          badge={
            <Badge color="module" variant="soft">
              {active} active
            </Badge>
          }
          description="Recurring booking series — each one materializes into individual bookings you can manage one by one. Create a series from the Bookings tab by turning on “Repeat”."
        />

        {series.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No recurring series yet"
              description="Book something on the Bookings tab and toggle “Repeat this booking” to set up a weekly, daily, or monthly series."
            />
          </Card>
        ) : (
          <Card padding="none">
            <SeriesList series={series} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
