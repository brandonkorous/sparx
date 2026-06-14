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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { GrantAccountCreditForm } from './_components/grant-account-credit-form';

export const dynamic = 'force-dynamic';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface AccountCreditCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

interface AccountCreditRow {
  id: string;
  customerId: string;
  balanceCents: number;
  currency: string;
  updatedAt: string;
  customer: AccountCreditCustomer | null;
}

interface CrmCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

function customerName(c: AccountCreditCustomer | null): string | null {
  if (!c) return null;
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full !== '' ? full : (c.company ?? c.email ?? null);
}

export default async function AccountCreditPage() {
  const [balances, customersPaged] = await Promise.all([
    api.get<AccountCreditRow[]>('/v1/commerce/account-credit?take=100'),
    api.getPaged<CrmCustomerRow[]>('/v1/crm/customers?take=200'),
  ]);

  const outstandingCents = balances.reduce((acc, b) => acc + b.balanceCents, 0);

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

        <Card>
          <CardHeader>
            <Heading level={3}>Outstanding balances</Heading>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <EmptyState
                icon={<CircleDollarSign className="h-5 w-5" />}
                title="No account credit issued yet"
                description="Grant credit above or have it auto-issued from a refund."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={`${b.customerId}:${b.currency}`}>
                      <TableCell>
                        <Stack gap={0}>
                          <Text size="sm">{customerName(b.customer) ?? '—'}</Text>
                          <Text size="xs" variant="muted">
                            {b.customer?.email ?? b.customerId.slice(0, 8) + '…'}
                          </Text>
                        </Stack>
                      </TableCell>
                      <TableCell>{moneyFmt.format(b.balanceCents / 100)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{b.currency}</span>
                      </TableCell>
                      <TableCell>
                        <Text size="xs" variant="muted">
                          {new Date(b.updatedAt).toLocaleDateString()}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
