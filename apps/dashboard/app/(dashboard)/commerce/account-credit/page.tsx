import { CircleDollarSign, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, Heading, PageHeader, Stack } from '@sparx/ui';

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
    <Container size="full">
      <Stack gap={6} className="py-10">
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

        <Heading level={3}>Outstanding balances</Heading>

        <ListToolbar enableViewToggle searchable={false} />

        {balances.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<CircleDollarSign className="h-5 w-5" />}
              title={total === 0 ? 'No account credit issued yet' : 'No balances on this page'}
              description="Grant credit with the New button, or have it auto-issued from a refund."
              action={
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
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
