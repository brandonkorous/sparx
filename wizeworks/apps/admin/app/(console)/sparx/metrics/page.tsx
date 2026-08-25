import Link from 'next/link';
import { hasCapability, requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import { Card, Heading, PageHeader, Stack, Text } from '@wizeworks/ui';
import {
  OperatorApiError,
  type OperatorAcquisitionSummary,
  type OperatorMetricsResult,
} from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatMoneyCents } from '@/lib/format';
import {
  ChurnCard,
  LifecycleCard,
  Metric,
  ModulesCard,
  RevenueCard,
  SignupsCard,
} from './_components/metrics-sections';
import {
  AcquisitionByCampaign,
  AcquisitionByChannel,
  AcquisitionBySource,
  AcquisitionTotals,
} from './_components/acquisition-sections';

const WINDOWS = [30, 90, 365];

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const operator = await requireCapability('support:read');
  const canSeeRevenue = hasCapability(operator, 'billing:read');
  const sp = await searchParams;
  const windowDays = WINDOWS.includes(Number(sp.window)) ? Number(sp.window) : 90;

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'support:read',
      action: 'metrics.view',
    });
  } catch {
    // best-effort audit — never blank the page on a logging failure
  }

  let metrics: OperatorMetricsResult | null = null;
  let error: string | null = null;
  try {
    metrics = await operatorApi().getMetrics({ windowDays }, operator.id);
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  // Fetched separately and allowed to fail on its own. The acquisition read is a
  // second cross-tenant scan, and a page that blanks entirely because ONE of its
  // two reads timed out is worse than a page that shows the metrics it has and
  // says the other section is unavailable.
  let acquisition: OperatorAcquisitionSummary | null = null;
  let acquisitionError: string | null = null;
  try {
    acquisition = await operatorApi().getAcquisition({ windowDays }, operator.id);
  } catch (err) {
    acquisitionError = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  if (!metrics) {
    return (
      <Stack gap={6}>
        <PageHeader title="Platform metrics" />
        <Card>
          <Text variant="muted">{error ?? 'Metrics unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const { lifecycle, revenue, signups, churn, modules } = metrics;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Platform metrics"
        description="Cross-tenant platform health — lifecycle, revenue, module adoption, signups, and churn across every account."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total tenants" value={lifecycle.total.toLocaleString('en-US')} />
        <Metric label="Active" value={lifecycle.active.toLocaleString('en-US')} />
        <Metric label="Trialing" value={lifecycle.trialing.toLocaleString('en-US')} />
        {canSeeRevenue ? (
          <Metric label="MRR" value={`${formatMoneyCents(revenue.mrrTotalCents)}/mo`} />
        ) : (
          <Metric label="Paying tenants" value={revenue.payingTenants.toLocaleString('en-US')} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LifecycleCard lifecycle={lifecycle} />
        {canSeeRevenue ? <RevenueCard revenue={revenue} /> : <ChurnCard churn={churn} />}
      </div>

      <Stack gap={2}>
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Text size="sm" variant="muted">
            Signup window:
          </Text>
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/sparx/metrics?window=${w}`}
              aria-current={w === windowDays ? 'true' : undefined}
              className={
                w === windowDays
                  ? 'text-base-content text-sm font-medium underline'
                  : 'text-base-content text-sm font-medium hover:underline'
              }
            >
              {w} days
            </Link>
          ))}
        </Stack>
        <SignupsCard signups={signups} />
      </Stack>

      <ModulesCard modules={modules} showRevenue={canSeeRevenue} />

      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2}>Acquisition</Heading>
          <Text size="sm">
            Where the accounts created in the last {windowDays} days came from. These count signups,
            not visits — somebody who read the site and left is in none of these numbers.
          </Text>
        </Stack>
        {acquisition ? (
          <>
            <AcquisitionTotals summary={acquisition} />
            <AcquisitionByChannel summary={acquisition} />
            <div className="grid gap-4 lg:grid-cols-2">
              <AcquisitionBySource summary={acquisition} />
              <AcquisitionByCampaign summary={acquisition} />
            </div>
          </>
        ) : (
          <Card>
            <Text>{acquisitionError ?? 'Acquisition data unavailable.'}</Text>
          </Card>
        )}
      </Stack>

      {canSeeRevenue ? <ChurnCard churn={churn} /> : null}

      <Text size="xs" variant="muted">
        Snapshot generated {new Date(metrics.generatedAt).toLocaleString('en-US')}. Storage, email
        volume, and setup-time metrics need a platform rollup and aren’t shown yet.
      </Text>
    </Stack>
  );
}
