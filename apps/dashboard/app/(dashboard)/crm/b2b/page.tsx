import { Building2, Plus } from 'lucide-react';

import {
  Badge,
  Card,
  Container,
  EmptyState,
  PageHeader,
  Stack,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { B2bAccountsSelectionTable } from './_components/b2b-accounts-selection-table';
import type { B2bAccountRow } from './_components/b2b-accounts-selection-table';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_VALUES = ['active', 'credit_hold', 'suspended', 'inactive'] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'credit_hold', label: 'Credit hold' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];

export default async function B2bAccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: '100' });
  if (status && (STATUS_VALUES as readonly string[]).includes(status)) query.set('status', status);
  if (q) query.set('q', q);

  const { data: accounts, meta } = await api.getPaged<B2bAccountRow[]>(
    `/v1/crm/b2b-accounts?${query.toString()}`
  );
  const total = (meta?.total as number | undefined) ?? accounts.length;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Building2 className="h-5 w-5" />}
          title="B2B accounts"
          badge={
            <Badge color="module">
              {total} account{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Wholesale + fleet customers. Pricing tier, credit limit, and engine profiles feed the fitment-aware catalog and the B2B portal pricing engine."
          actions={
            <EntityCreateButton
              entityType="b2b-account"
              newHref="/crm/b2b/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchPlaceholder="Search company…"
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
        />

        {accounts.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No B2B accounts yet"
              description="Add a wholesale or fleet customer to start tracking pricing tiers, credit, and engine profiles."
              action={
                <EntityCreateButton
                  entityType="b2b-account"
                  newHref="/crm/b2b/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <B2bAccountsSelectionTable accounts={accounts} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
