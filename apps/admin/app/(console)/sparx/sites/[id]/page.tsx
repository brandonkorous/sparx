import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  Badge,
  Card,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import { OperatorApiError, type OperatorSiteDetail } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate } from '@/lib/format';
import { domainStatusTone, domainTypeLabel, siteStatusLabel, siteStatusTone } from '@/lib/sites';
import { SiteStatusControl } from './_components/site-status-control';

const backLink = (
  <Link href="/sparx/sites" className="text-base-content text-sm hover:underline">
    ← All sites
  </Link>
);

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireCapability('site:read');
  const { id } = await params;

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'site:read',
      action: 'site.detail.view',
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  let site: OperatorSiteDetail | null = null;
  let error: string | null = null;
  try {
    site = await operatorApi().getSite(id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  if (!site) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Site unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const canAct = hasCapability(operator, 'site:act');

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Heading level={1}>{site.name}</Heading>
          <Badge color={siteStatusTone(site.status)} variant="soft">
            {siteStatusLabel(site.status)}
          </Badge>
          {site.isPrimary ? (
            <Badge color="primary" variant="soft">
              Primary
            </Badge>
          ) : null}
          {canAct ? (
            <div className="ml-auto">
              <SiteStatusControl
                siteId={id}
                tenantId={site.tenantId}
                siteName={site.name}
                status={site.status}
              />
            </div>
          ) : null}
        </Stack>
        <Text variant="muted">
          {site.slug} ·{' '}
          {site.tenantName ? (
            <Link href={`/sparx/tenants/${site.tenantId}`} className="text-module hover:underline">
              {site.tenantName}
            </Link>
          ) : (
            (site.tenantSlug ?? site.tenantId)
          )}{' '}
          · Created {formatDate(site.createdAt)}
        </Text>
      </Stack>

      <Card>
        <Stack gap={4}>
          <Heading level={2}>
            Addresses{' '}
            <Text as="span" size="sm" variant="muted">
              ({site.domains.length})
            </Text>
          </Heading>
          {site.domains.length === 0 ? (
            <Text variant="muted">No web addresses point at this site yet.</Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {site.domains.map((d) => (
                  <TableRow key={d.host}>
                    <TableCell>
                      <Stack direction="row" align="center" gap={2}>
                        <Text className="font-medium">{d.host}</Text>
                        {d.isCanonical ? (
                          <Badge color="info" variant="soft" size="sm">
                            Primary address
                          </Badge>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{domainTypeLabel(d.type)}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge color={domainStatusTone(d.status)} variant="soft" size="sm">
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {d.verifiedAt ? formatDate(d.verifiedAt) : '—'}
                      </Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </Card>

      {site.moduleScope.length > 0 ? (
        <Card>
          <Stack gap={2}>
            <Heading level={2}>Modules disabled for this site</Heading>
            <Text size="sm" variant="muted">
              These modules are active for the tenant but turned off on this site only.
            </Text>
            <Stack direction="row" gap={2} className="flex-wrap">
              {site.moduleScope.map((slug) => (
                <Badge key={slug} color="neutral" variant="soft">
                  {slug}
                </Badge>
              ))}
            </Stack>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
