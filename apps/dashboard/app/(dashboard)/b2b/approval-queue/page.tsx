import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

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

import { api } from '@/lib/api-rest-client';
import { ApproveRejectActions } from './_components/approve-reject-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface QueuedOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  b2bAccountId: string | null;
  companyName: string | null;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function ApprovalQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: '100' });
  if (accountId) query.set('account_id', accountId);

  const { data: orders, meta } = await api.getPaged<QueuedOrder[]>(
    `/v1/b2b/approval-queue?${query.toString()}`
  );
  const total = (meta?.total as number | undefined) ?? orders.length;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CheckCircle className="h-5 w-5" />}
          title="Approval Queue"
          badge={
            total > 0 ? (
              <Badge color="warning" variant="soft">
                {total} pending
              </Badge>
            ) : (
              <Badge color="success" variant="soft">
                All clear
              </Badge>
            )
          }
          description="B2B portal orders waiting for staff review before they are placed."
        />

        {orders.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<CheckCircle className="h-5 w-5" />}
              title="No orders pending approval"
              description="B2B portal orders that exceed an approval threshold will appear here."
            />
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Text size="sm" className="font-medium tabular-nums">
                      #{order.orderNumber}
                    </Text>
                  </TableCell>
                  <TableCell>
                    {order.b2bAccountId ? (
                      <Link
                        href={`/b2b/accounts/${order.b2bAccountId}`}
                        className="text-sm hover:text-[var(--module-active)] hover:underline"
                      >
                        {order.companyName ?? order.b2bAccountId}
                      </Link>
                    ) : (
                      <Text size="sm" variant="muted">
                        —
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <Text size="sm">{order.customerName ?? order.customerEmail}</Text>
                      {order.customerName && (
                        <Text size="xs" variant="muted">
                          {order.customerEmail}
                        </Text>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" className="font-medium tabular-nums">
                      {formatCents(order.totalCents)}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <ApproveRejectActions orderId={order.id} orderNumber={order.orderNumber} />
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
