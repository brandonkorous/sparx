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
import type { OperatorTenantListItem } from '@sparx/operator';
import { formatDate, formatMoneyCents } from '@/lib/format';

// The cross-tenant tenant list, rendered read-only. Status + subscription pills
// resolve their tone through the platform `statusTone` dictionary so `active`
// reads green and `past_due` red exactly as they do in the tenant's dashboard
// (representation parity, D7). Row click-through opens the tenant detail.
export function TenantsTable({ tenants }: { tenants: OperatorTenantListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tenant</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Modules</TableHead>
          <TableHead className="text-right">MRR</TableHead>
          <TableHead>Subscription</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell>
              <Stack gap={0}>
                <Link
                  href={`/sparx/tenants/${tenant.id}`}
                  className="font-medium text-[var(--color-text-primary)] hover:underline"
                >
                  {tenant.name}
                </Link>
                <Text size="xs" variant="muted">
                  {tenant.slug}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>
              <Badge color={statusTone(tenant.status)} variant="soft">
                {statusLabel(tenant.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Stack direction="row" align="center" gap={2}>
                <Text size="sm">{tenant.plan}</Text>
                {tenant.planType === 'enterprise' ? (
                  <Badge color="primary" variant="soft" size="sm">
                    Enterprise
                  </Badge>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {tenant.activeModules.length} active
              </Text>
            </TableCell>
            <TableCell className="text-right">
              <Text size="sm" className="tabular-nums">
                {formatMoneyCents(tenant.mrrCents)} /mo
              </Text>
            </TableCell>
            <TableCell>
              {tenant.subscriptionStatus ? (
                <Badge color={statusTone(tenant.subscriptionStatus)} variant="soft">
                  {statusLabel(tenant.subscriptionStatus)}
                </Badge>
              ) : (
                <Text size="sm" variant="muted">
                  No subscription
                </Text>
              )}
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(tenant.createdAt)}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
