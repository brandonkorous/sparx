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
import type { OperatorDomainListItem } from '@wizeworks/operator';
import { formatDate } from '@/lib/format';
import {
  domainStatusLabel,
  domainStatusTone,
  domainTypeLabel,
  sslLabel,
  sslTone,
} from '@/lib/domains';

// The cross-tenant domain list, read-only. Two color axes: the routing STATUS
// (statusTone-consistent with the tenant dashboard) and the SSL/TLS readiness
// derived from it. Host click-through opens the domain detail; the tenant links
// straight to that account. Expiring-soon purchased domains flag inline.
export function DomainsTable({ domains }: { domains: OperatorDomainListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>SSL</TableHead>
          <TableHead>Expires</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {domains.map((d) => (
          <TableRow key={d.id}>
            <TableCell>
              <Stack gap={0}>
                <Link
                  href={`/sparx/domains/${d.id}`}
                  className="text-base-content font-medium hover:underline"
                >
                  {d.host}
                </Link>
                {d.isCanonical ? (
                  <Text size="xs" variant="muted">
                    Primary domain
                  </Text>
                ) : null}
              </Stack>
            </TableCell>
            <TableCell>
              <Link
                href={`/sparx/tenants/${d.tenantId}`}
                className="text-module text-sm hover:underline"
              >
                {d.tenantName}
              </Link>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {domainTypeLabel(d.type)}
              </Text>
            </TableCell>
            <TableCell>
              <Badge color={domainStatusTone(d.status)} variant="soft">
                {domainStatusLabel(d.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge color={sslTone(d.sslStatus)} variant="soft">
                {sslLabel(d.sslStatus)}
              </Badge>
            </TableCell>
            <TableCell>
              {d.expiresAt ? (
                <Stack direction="row" align="center" gap={2}>
                  <Text size="sm" variant="muted">
                    {formatDate(d.expiresAt)}
                  </Text>
                  {d.expiringSoon ? (
                    <Badge color="warning" variant="soft" size="sm">
                      Soon
                    </Badge>
                  ) : null}
                </Stack>
              ) : (
                <Text size="sm" variant="muted">
                  —
                </Text>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
