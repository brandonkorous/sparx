import { Users } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle, EmptyState } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';

import { MergeCandidatesGroup } from './_components/merge-candidates-group';

// Find-duplicates landing — surfaces groups of customers that share an email
// or share (last name, company). Picks the most-recently-updated of each
// group as the suggested primary so a merge defaults to a sensible target.

export const dynamic = 'force-dynamic';

interface DuplicateGroup {
  reason: 'email' | 'name_company';
  customers: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string | null;
    type: string;
    orderCount: number;
    totalSpent: string | number;
    updatedAt: string;
  }[];
}

export default async function DuplicatesPage() {
  const groups = await api.get<DuplicateGroup[]>('/v1/crm/customers/duplicates');

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title="Find duplicates"
          badge={
            <Badge color="module">
              {groups.length} group{groups.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Customers grouped by shared email, or by matching last name + company. Merge folds duplicates into a chosen primary — all activities, deals, and tasks reattach automatically."
        />

        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No duplicates found"
              description="The CRM scanned the most-recently-updated customers and didn't find any obvious duplicates."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group, idx) => (
              <Card key={`${group.reason}-${idx}`}>
                <CardBody>
                  <div className="flex flex-row items-center gap-2">
                    <CardTitle>
                      {group.reason === 'email' ? 'Shared email' : 'Same last name + company'}
                    </CardTitle>
                    <Badge color="neutral" variant="soft" size="sm">
                      {group.customers.length} records
                    </Badge>
                  </div>
                  <MergeCandidatesGroup customers={group.customers} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
