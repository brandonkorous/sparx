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
} from '@sparx/ui';
import type { OperatorSiteListItem } from '@sparx/operator';
import { formatDate } from '@/lib/format';
import { siteStatusLabel, siteStatusTone } from '@/lib/sites';

// The cross-tenant site roster, rendered read-only. Row click-through opens the
// site detail; the owning tenant links to that tenant's detail. Status reads as a
// semantic badge, the primary site is flagged.
export function SitesTable({ sites }: { sites: OperatorSiteListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Site</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Addresses</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sites.map((site) => (
          <TableRow key={site.id}>
            <TableCell>
              <Stack gap={0}>
                <Stack direction="row" align="center" gap={2}>
                  <Link
                    href={`/sparx/sites/${site.id}`}
                    className="text-base-content font-medium hover:underline"
                  >
                    {site.name}
                  </Link>
                  {site.isPrimary ? (
                    <Badge color="primary" variant="soft" size="sm">
                      Primary
                    </Badge>
                  ) : null}
                </Stack>
                <Text size="xs" variant="muted">
                  {site.slug}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>
              {site.tenantName ? (
                <Link
                  href={`/sparx/tenants/${site.tenantId}`}
                  className="text-module text-sm hover:underline"
                >
                  {site.tenantName}
                </Link>
              ) : (
                <Text size="sm" variant="muted">
                  {site.tenantSlug ?? '—'}
                </Text>
              )}
            </TableCell>
            <TableCell>
              <Badge color={siteStatusTone(site.status)} variant="soft">
                {siteStatusLabel(site.status)}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {site.domainCount}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(site.createdAt)}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
