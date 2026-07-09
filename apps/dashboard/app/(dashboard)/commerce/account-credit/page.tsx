import { CircleDollarSign, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { AccountCreditList, type AccountCreditRow } from './_components/account-credit-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountCreditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, balancesPaged] = await Promise.all([
    getUserPreferences(),
    api.getPaged<AccountCreditRow[]>(
      `/v1/commerce/account-credit?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const balances = balancesPaged.data;
  const total = (balancesPaged.meta?.total as number | undefined) ?? balances.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<CircleDollarSign className="h-5 w-5" />}
          title="Account credit"
          badge={
            <Badge color="module">
              {total} balance{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Per-customer credit balance — accrues from refunds, loyalty conversions, or manual grants. Spent at checkout via the pricing pipeline."
          actions={
            <EntityCreateButton
              entityType="account-credit"
              newHref="/commerce/account-credit/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <h3 className="text-xl font-semibold">Outstanding balances</h3>

        <ListToolbar enableViewToggle searchable={false} />

        {balances.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CircleDollarSign className="h-5 w-5" />}
              title={total === 0 ? 'No account credit issued yet' : 'No balances on this page'}
              description="Grant credit with the New button, or have it auto-issued from a refund."
              actions={
                total === 0 ? (
                  <EntityCreateButton
                    entityType="account-credit"
                    newHref="/commerce/account-credit/new"
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    New
                  </EntityCreateButton>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <AccountCreditList balances={balances} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
