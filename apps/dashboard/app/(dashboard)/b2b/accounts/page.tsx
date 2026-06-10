import { Building2, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { B2bAccountsSelectionTable } from './_components/b2b-accounts-selection-table';
import { B2bAccountsImportExport } from './_components/b2b-accounts-import-export';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export interface B2bAccountRow {
  id: string;
  companyName: string;
  status: string;
  pricingTierId: string | null;
  pricingTierName: string | null;
  creditLimitCents: number;
  creditUsedCents: number;
  creditRemainingCents: number;
  creditUtilizationPct: number;
  paymentTerms: string | null;
  discountPercent: number;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'credit_hold', label: 'Credit hold' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function B2bAccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const tierId = stringParam(params.tier_id);
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: '100' });
  if (status) query.set('status', status);
  if (tierId) query.set('tier_id', tierId);
  if (q) query.set('q', q);

  const { data: accounts, meta } = await api.getPaged<B2bAccountRow[]>(
    `/v1/b2b/accounts?${query.toString()}`
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
          description="Wholesale and fleet customers. Pricing tiers, credit limits, and account-level overrides power the B2B commerce engine."
          actions={
            <Stack direction="row" gap={2}>
              <B2bAccountsImportExport />
              <EntityCreateButton
                entityType="b2b-account"
                newHref="/b2b/accounts/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New account
              </EntityCreateButton>
            </Stack>
          }
        />

        <ListToolbar
          searchPlaceholder="Search company…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
        />

        {accounts.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No B2B accounts yet"
              description="Add wholesale or fleet customers to assign pricing tiers, credit terms, and product overrides."
              action={
                <EntityCreateButton
                  entityType="b2b-account"
                  newHref="/b2b/accounts/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New account
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
