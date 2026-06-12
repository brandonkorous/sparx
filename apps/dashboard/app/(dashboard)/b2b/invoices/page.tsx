import { Receipt } from 'lucide-react';

import {
  Badge,
  Card,
  Container,
  EmptyState,
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
import Link from 'next/link';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  amountCents: number;
  balanceCents: number;
  overdueDays: number;
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
  account: { id: string; companyName: string } | null;
}

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger'> = {
  unpaid: 'outline',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'outline',
};

const STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Voided' },
];

const OPEN_STATUSES = ['unpaid', 'partial', 'overdue'];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function B2bInvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: '100' });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  const { data: invoices, meta } = await api.getPaged<InvoiceRow[]>(
    `/v1/b2b/invoices?${query.toString()}`
  );
  const total = (meta?.total as number | undefined) ?? invoices.length;

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const totalOwed = invoices
    .filter((i) => OPEN_STATUSES.includes(i.status))
    .reduce((sum, i) => sum + i.balanceCents, 0);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title="Invoices"
          badge={
            <Badge color="module">
              {total} invoice{total === 1 ? '' : 's'}
            </Badge>
          }
          description={`Net-terms invoices across all B2B accounts. ${overdueCount > 0 ? `${overdueCount} overdue.` : 'All current.'}`}
          actions={
            overdueCount > 0 ? (
              <Badge color="danger" variant="soft">
                {overdueCount} overdue — {formatCents(totalOwed)} outstanding
              </Badge>
            ) : (
              <Text size="sm" variant="muted">
                {formatCents(totalOwed)} outstanding
              </Text>
            )
          }
        />

        <ListToolbar
          searchPlaceholder="Search by invoice # or account…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
        />

        {invoices.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No invoices yet"
              description="Net-terms orders automatically generate invoices. Manual invoices can also be created from an account's detail page."
            />
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Overdue days</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-[var(--color-surface-subtle)]">
                  <TableCell>
                    <Link
                      href={`/b2b/invoices/${inv.id}`}
                      className="font-medium hover:text-[var(--module-active)] hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {inv.account ? (
                      <Link
                        href={`/b2b/accounts/${inv.account.id}`}
                        className="text-sm hover:text-[var(--module-active)] hover:underline"
                      >
                        {inv.account.companyName}
                      </Link>
                    ) : (
                      <Text size="sm" variant="muted">
                        —
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_VARIANT[inv.status] ?? 'outline'} variant="soft">
                      {inv.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" className="tabular-nums">
                      {formatCents(inv.amountCents)}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text
                      size="sm"
                      className={inv.status === 'overdue' ? 'text-[var(--color-danger)]' : ''}
                    >
                      {new Date(inv.dueAt).toLocaleDateString()}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant={inv.overdueDays > 0 ? 'default' : 'muted'}>
                      {inv.overdueDays > 0 ? `${inv.overdueDays}d` : '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
