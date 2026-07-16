import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Badge, Card, Heading, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorDomainDetail } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { domainStatusLabel, domainStatusTone, domainTypeLabel } from '@/lib/domains';
import { formatDate } from '@/lib/format';
import { ReverifyButton } from './_components/reverify-button';
import {
  DnsProbeCard,
  PurchaseHistoryCard,
  RegistrarCard,
  RoutingCard,
  SslCard,
} from './_components/domain-detail-sections';

const backLink = (
  <Link href="/sparx/domains" className="text-base-content text-sm hover:underline">
    ← All domains
  </Link>
);

export default async function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireCapability('domain:manage');
  const { id } = await params;

  let domain: OperatorDomainDetail | null = null;
  let error: string | null = null;
  try {
    domain = await operatorApi().getDomain(id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  // Audit the cross-tenant detail view, attributing the target tenant (§7).
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'domain:manage',
      action: 'domain.detail.view',
      targetTenantId: domain?.tenant.id,
      diff: { host: domain?.host },
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  if (!domain) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Domain unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" justify="between" className="flex-wrap gap-3">
          <Stack direction="row" align="center" gap={3} className="flex-wrap">
            <Heading level={1} className="break-all">
              {domain.host}
            </Heading>
            <Badge color={domainStatusTone(domain.status)} variant="soft">
              {domainStatusLabel(domain.status)}
            </Badge>
            {domain.isCanonical ? (
              <Badge color="primary" variant="soft">
                Primary
              </Badge>
            ) : null}
          </Stack>
          <ReverifyButton domainId={domain.id} tenantId={domain.tenant.id} host={domain.host} />
        </Stack>
        <Text variant="muted">
          {domainTypeLabel(domain.type)} · {domain.tenant.name} · Connected{' '}
          {formatDate(domain.createdAt)}
        </Text>
      </Stack>

      <div className="grid gap-4 md:grid-cols-2">
        <RoutingCard domain={domain} />
        <SslCard domain={domain} />
        {domain.type === 'purchased' ? <RegistrarCard domain={domain} /> : null}
        <DnsProbeCard probe={domain.dnsProbe} />
      </div>

      <PurchaseHistoryCard domain={domain} />
    </Stack>
  );
}
