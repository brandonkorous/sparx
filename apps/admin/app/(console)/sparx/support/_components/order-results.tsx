import Link from 'next/link';
import {
  Badge,
  statusLabel,
  statusTone,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import type { OperatorOrderHit } from '@sparx/operator';
import { formatDate, formatMoneyCents } from '@/lib/format';
import { ResendButton } from './resend-button';

// Cross-tenant order search results. Each row shows the owning tenant (linked)
// and, for operators with support:act, a re-send-confirmation action. Read-only
// otherwise — order status + payment resolve their tone through `statusTone`,
// consistent with the tenant dashboard.
export function OrderResults({ orders, canAct }: { orders: OperatorOrderHit[]; canAct: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Placed</TableHead>
          {canAct ? <TableHead className="text-right">Action</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={`${o.tenantId}:${o.orderId}`}>
            <TableCell>
              <Text size="sm" className="font-mono font-medium">
                {o.orderNumber}
              </Text>
            </TableCell>
            <TableCell>
              <Link
                href={`/sparx/tenants/${o.tenantId}`}
                className="text-sm text-[var(--module-active-text)] hover:underline"
              >
                {o.tenantName}
              </Link>
            </TableCell>
            <TableCell>
              <Stack gap={0}>
                <Text size="sm">{o.customerName ?? '—'}</Text>
                {o.customerEmail ? (
                  <Text size="xs" variant="muted">
                    {o.customerEmail}
                  </Text>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>
              <Badge color={statusTone(o.status)} variant="soft">
                {statusLabel(o.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge color={statusTone(o.paymentStatus)} variant="soft">
                {statusLabel(o.paymentStatus)}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <Text size="sm">{formatMoneyCents(o.totalCents)}</Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(o.placedAt)}
              </Text>
            </TableCell>
            {canAct ? (
              <TableCell className="text-right">
                <ResendButton
                  tenantId={o.tenantId}
                  orderId={o.orderId}
                  orderNumber={o.orderNumber}
                  customerEmail={o.customerEmail}
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
