export const dynamic = 'force-dynamic';

import { ShieldCheck } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { BookingPolicy } from '../_lib/types';
import { NewPolicyButton } from './_components/new-policy-button';
import { PoliciesList } from './_components/policies-list';

export default async function SchedulingPoliciesPage() {
  const policies = await api
    .get<BookingPolicy[]>('/v1/scheduling/policies')
    .catch(() => [] as BookingPolicy[]);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Policies"
          badge={
            <Badge color="module" variant="soft">
              {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}
            </Badge>
          }
          description="Deposits, cancellation windows, no-show fees, and reminders — attach a policy to a service to protect against no-shows."
          actions={<NewPolicyButton />}
        />

        {policies.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No policies yet"
              description="Create a policy to require deposits or card holds and set your cancellation rules."
              action={<NewPolicyButton />}
            />
          </Card>
        ) : (
          <Card padding="none">
            <PoliciesList policies={policies} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
