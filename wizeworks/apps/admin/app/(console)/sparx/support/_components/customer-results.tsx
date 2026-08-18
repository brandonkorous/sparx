import Link from 'next/link';
import {
  Badge,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type { OperatorCustomerHit } from '@wizeworks/operator';
import { formatDate, formatMoneyCents } from '@/lib/format';
import { customerTypeTone } from '@/lib/support';

// Cross-tenant customer search results. Each row links to the owning tenant.
// Read-only — the operator understands the account, they don't edit it (D7).
export function CustomerResults({ customers }: { customers: OperatorCustomerHit[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Company</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Spent</TableHead>
          <TableHead>Last order</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => (
          <TableRow key={`${c.tenantId}:${c.customerId}`}>
            <TableCell>
              <Stack gap={0}>
                <Text size="sm" className="font-medium">
                  {c.fullName || '—'}
                </Text>
                {c.email ? (
                  <Text size="xs" variant="muted">
                    {c.email}
                  </Text>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>
              <Link
                href={`/sparx/tenants/${c.tenantId}`}
                className="text-module text-sm hover:underline"
              >
                {c.tenantName}
              </Link>
            </TableCell>
            <TableCell>
              <Badge color={customerTypeTone(c.type)} variant="soft">
                {c.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {c.company ?? '—'}
              </Text>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Text size="sm">{c.orderCount}</Text>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Text size="sm">{formatMoneyCents(c.totalSpentCents)}</Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(c.lastOrderAt) ?? '—'}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
