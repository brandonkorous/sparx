export const dynamic = 'force-dynamic';

import { Hourglass } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { WaitlistEntry } from '../_lib/types';
import { WaitlistList } from './_components/waitlist-list';

export default async function SchedulingWaitlistPage() {
  const entries = await api
    .get<WaitlistEntry[]>('/v1/scheduling/waitlist')
    .catch(() => [] as WaitlistEntry[]);

  const waiting = entries.filter((e) => e.status === 'waiting').length;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Hourglass className="h-5 w-5" />}
          title="Waitlist"
          badge={
            <Badge color="module" variant="soft">
              {waiting} waiting
            </Badge>
          }
          description="Customers waiting for an opening. When a slot frees in their window they're offered it automatically; you can also offer or book one for them here."
        />

        {entries.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No one's waiting"
              description="Customers join the waitlist from your booking page when their preferred time is full."
            />
          </Card>
        ) : (
          <Card padding="none">
            <WaitlistList entries={entries} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
