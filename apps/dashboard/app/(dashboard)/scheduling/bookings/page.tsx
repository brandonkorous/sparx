export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListPager } from '../../_components/list-pager';
import type { Booking, SchedulingService } from '../_lib/types';
import { NewBookingButton } from './_components/new-booking-button';
import { BookingsList } from './_components/bookings-list';

const FILTERS: { label: string; status?: string }[] = [
  { label: 'All' },
  { label: 'Requested', status: 'requested' },
  { label: 'Confirmed', status: 'confirmed' },
  { label: 'In progress', status: 'in_progress' },
  { label: 'Completed', status: 'completed' },
  { label: 'Cancelled', status: 'cancelled' },
];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingBookingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = typeof params.status === 'string' ? params.status : undefined;

  const qs = new URLSearchParams({ take: String(take), skip: String(skip), order: 'desc' });
  if (status) qs.set('status', status);

  const [{ data: bookings, meta }, services] = await Promise.all([
    api
      .getPaged<Booking[]>(`/v1/scheduling/bookings?${qs}`)
      .catch(() => ({ data: [] as Booking[], meta: {}, etag: null })),
    api.get<SchedulingService[]>('/v1/scheduling/services').catch(() => [] as SchedulingService[]),
  ]);
  const total = ((meta as Record<string, unknown>)?.total as number | undefined) ?? bookings.length;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CalendarClock className="h-5 w-5" />}
          title="Bookings"
          badge={
            <Badge color="module" variant="soft">
              {total} booking{total !== 1 ? 's' : ''}
            </Badge>
          }
          description="Every appointment, class, reservation, and rental — confirm, check in, reschedule, or cancel."
          actions={<NewBookingButton />}
        />

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = (f.status ?? '') === (status ?? '');
            const href = f.status
              ? `/scheduling/bookings?status=${f.status}`
              : '/scheduling/bookings';
            return (
              <Link key={f.label} href={href}>
                <Badge color={active ? 'module' : 'neutral'} variant={active ? 'solid' : 'soft'}>
                  {f.label}
                </Badge>
              </Link>
            );
          })}
        </div>

        {bookings.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title={status ? `No ${status.replace('_', ' ')} bookings` : 'No bookings yet'}
              description={
                services.length === 0
                  ? 'Create a service and set availability, then take your first booking.'
                  : 'New bookings will appear here. Create one to get started.'
              }
              action={services.length > 0 ? <NewBookingButton /> : undefined}
            />
          </Card>
        ) : (
          <Card padding="none">
            <BookingsList bookings={bookings} />
          </Card>
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}
