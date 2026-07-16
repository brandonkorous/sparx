import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Badge, Card, Heading, statusLabel, statusTone, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorTenantDetail } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatBytes, formatDate, formatMoneyCents } from '@/lib/format';
import {
  AcquisitionCard,
  ActivityCard,
  DomainsCard,
  ModulesCard,
  SitesCard,
  StorageCard,
  SubscriptionCard,
  TeamCard,
} from '../_components/tenant-detail-sections';
import { ModuleSwitchboard } from './_components/module-switchboard';
import { SuspendControl } from './_components/suspend-control';
import { StorageLimitControl } from './_components/storage-limit-control';

const backLink = (
  <Link href="/sparx/tenants" className="text-base-content text-sm hover:underline">
    ← All tenants
  </Link>
);

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireCapability('support:read');
  const { id } = await params;

  // Audit the cross-tenant detail view, attributing the target tenant (§7).
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'support:read',
      action: 'tenant.detail.view',
      targetTenantId: id,
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  let tenant: OperatorTenantDetail | null = null;
  let error: string | null = null;
  try {
    tenant = await operatorApi().getTenant(id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  if (!tenant) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Tenant unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const interval = tenant.billing.billingInterval === 'annual' ? 'yr' : 'mo';
  const activeCount = tenant.modules.filter((m) => m.enabled).length;
  const canToggleModules = hasCapability(operator, 'module:toggle');
  const canSuspend = hasCapability(operator, 'tenant:suspend');

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Heading level={1}>{tenant.name}</Heading>
          <Badge color={statusTone(tenant.status)} variant="soft">
            {statusLabel(tenant.status)}
          </Badge>
          {tenant.billing.planType === 'enterprise' ? (
            <Badge color="primary" variant="soft">
              Enterprise
            </Badge>
          ) : null}
          {canSuspend ? (
            <div className="ml-auto">
              <SuspendControl tenantId={id} tenantName={tenant.name} status={tenant.status} />
            </div>
          ) : null}
        </Stack>
        <Text variant="muted">
          {tenant.slug} · {tenant.email} · Joined {formatDate(tenant.createdAt)}
        </Text>
        <Stack direction="row" align="center" gap={4} className="flex-wrap">
          {hasCapability(operator, 'billing:read') ? (
            <Link
              href={`/sparx/tenants/${id}/billing`}
              className="text-module text-sm font-medium hover:underline"
            >
              Billing — charges, refunds & invoices →
            </Link>
          ) : null}
          {hasCapability(operator, 'domain:manage') ? (
            <Link
              href={`/sparx/domains?tenantId=${id}`}
              className="text-module text-sm font-medium hover:underline"
            >
              Domains — routing, SSL & verification →
            </Link>
          ) : null}
          <Link
            href={`/sparx/tenants/${id}/support`}
            className="text-module text-sm font-medium hover:underline"
          >
            Support — search index & email log →
          </Link>
          {hasCapability(operator, 'feedback:respond') ? (
            <Link
              href={`/sparx/feedback?tenantId=${id}`}
              className="text-module text-sm font-medium hover:underline"
            >
              Feedback — this tenant’s submissions →
            </Link>
          ) : null}
        </Stack>
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="MRR"
          value={`${formatMoneyCents(tenant.billing.planTotalCents)}/${interval}`}
        />
        <KpiCard label="Active modules" value={String(activeCount)} />
        <KpiCard label="Storage" value={formatBytes(tenant.storage.totalBytes)} />
        <KpiCard label="Domains" value={String(tenant.domains.length)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SubscriptionCard billing={tenant.billing} />
        {canToggleModules ? null : <ModulesCard modules={tenant.modules} />}
        <StorageCard storage={tenant.storage} />
        <AcquisitionCard acquisition={tenant.acquisition} />
      </div>

      {canToggleModules ? (
        <ModuleSwitchboard tenantId={id} tenantName={tenant.name} modules={tenant.modules} />
      ) : null}

      {canSuspend ? (
        <StorageLimitControl tenantId={id} currentLimitBytes={tenant.storage.storageLimitBytes} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TeamCard members={tenant.members} />
        <SitesCard sites={tenant.sites} />
      </div>

      <DomainsCard domains={tenant.domains} />
      <ActivityCard activity={tenant.recentActivity} />
    </Stack>
  );
}

/** A compact metric tile for the tenant header KPI row. */
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Stack gap={1}>
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <Text className="text-2xl font-medium tracking-tight">{value}</Text>
      </Stack>
    </Card>
  );
}
