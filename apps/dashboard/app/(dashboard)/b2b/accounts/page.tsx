import { Building2, Plus } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { B2bAccountsSelectionTable } from './_components/b2b-accounts-selection-table';
import { B2bAccountsImportExport } from './_components/b2b-accounts-import-export';
import { getUserPreferences } from '../../_shell/preferences';

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
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const tierId = stringParam(params.tier_id);
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (tierId) query.set('tier_id', tierId);
  if (q) query.set('q', q);

  const [prefs, { data: accounts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<B2bAccountRow[]>(`/v1/b2b/accounts?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? accounts.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
            <div className="flex flex-row gap-2">
              <B2bAccountsImportExport />
              <EntityCreateButton
                entityType="b2b-account"
                newHref="/b2b/accounts/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New account
              </EntityCreateButton>
            </div>
          }
        />

        <ListToolbar
          searchPlaceholder="Search company…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {accounts.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                title="No B2B accounts yet"
                description="Add wholesale or fleet customers to assign pricing tiers, credit terms, and product overrides."
                actions={
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
            </CardBody>
          </Card>
        ) : (
          <B2bAccountsSelectionTable accounts={accounts} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}
