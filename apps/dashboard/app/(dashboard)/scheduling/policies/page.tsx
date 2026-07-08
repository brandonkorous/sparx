export const dynamic = 'force-dynamic';

import { ShieldCheck } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { BookingPolicy } from '../_lib/types';
import { NewPolicyButton } from './_components/new-policy-button';
import { PoliciesList } from './_components/policies-list';

export default async function SchedulingPoliciesPage() {
  const policies = await api
    .get<BookingPolicy[]>('/v1/scheduling/policies')
    .catch(() => [] as BookingPolicy[]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
          <Card>
            <CardBody className="p-0">
              <EmptyState
                title="No policies yet"
                description="Create a policy to require deposits or card holds and set your cancellation rules."
                actions={<NewPolicyButton />}
              />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-0">
              <PoliciesList policies={policies} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
