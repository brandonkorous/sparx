import { CircleDollarSign } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { GrantAccountCreditForm } from './_components/grant-account-credit-form';
import { AccountCreditList, type AccountCreditRow } from './_components/account-credit-list';

export const dynamic = 'force-dynamic';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface CrmCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountCreditPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, balances, customersPaged] = await Promise.all([
    getUserPreferences(),
    api.get<AccountCreditRow[]>('/v1/commerce/account-credit?take=100'),
    api.getPaged<CrmCustomerRow[]>('/v1/crm/customers?take=200'),
  ]);

  const outstandingCents = balances.reduce((acc, b) => acc + b.balanceCents, 0);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const recentCustomers = customersPaged.data.map((c) => {
    const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const name = full !== '' ? full : (c.email ?? c.id.slice(0, 8) + '…');
    return { id: c.id, email: c.email, name };
  });

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CircleDollarSign className="h-5 w-5" />}
          title="Account credit"
          badge={
            <Badge color="module">{moneyFmt.format(outstandingCents / 100)} outstanding</Badge>
          }
          description="Per-customer credit balance — accrues from refunds, loyalty conversions, or manual grants. Spent at checkout via the pricing pipeline."
        />

        <Card>
          <CardHeader>
            <Stack gap={1}>
              <Heading level={3}>Grant credit</Heading>
              <CardDescription>
                Adds to a customer&apos;s balance for the named currency. New customer + new
                currency creates a fresh balance row.
              </CardDescription>
            </Stack>
          </CardHeader>
          <CardContent>
            <GrantAccountCreditForm customers={recentCustomers} />
          </CardContent>
        </Card>

        <Heading level={3}>Outstanding balances</Heading>

        <ListToolbar enableViewToggle searchable={false} />

        {balances.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<CircleDollarSign className="h-5 w-5" />}
              title="No account credit issued yet"
              description="Grant credit above or have it auto-issued from a refund."
            />
          </Card>
        ) : (
          <AccountCreditList balances={balances} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
