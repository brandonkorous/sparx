import {
  Badge,
  Card,
  Heading,
  ModuleProvider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type {
  OperatorMetricsChurn,
  OperatorMetricsLifecycle,
  OperatorMetricsModule,
  OperatorMetricsRevenue,
  OperatorMetricsSignups,
} from '@wizeworks/operator';
import { moduleColor, moduleLabel } from '@/lib/modules';
import { formatMoneyCents } from '@/lib/format';

// The platform-metrics sections. Financial figures (RevenueCard + the MRR column)
// render only when the operator holds `billing:read` — default-deny at the panel
// level (D5). Everything else is `support:read`.

/** A label + big number tile. */
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Stack gap={1}>
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <Text className="text-2xl font-medium tracking-tight tabular-nums">{value}</Text>
      </Stack>
    </Card>
  );
}

export function LifecycleCard({ lifecycle }: { lifecycle: OperatorMetricsLifecycle }) {
  const items: { label: string; value: number }[] = [
    { label: 'Active', value: lifecycle.active },
    { label: 'Trialing', value: lifecycle.trialing },
    { label: 'With subscription', value: lifecycle.withSubscription },
    { label: 'Past due', value: lifecycle.pastDue },
    { label: 'Canceled', value: lifecycle.canceled },
    { label: 'Paused', value: lifecycle.paused },
    { label: 'Suspended', value: lifecycle.suspended },
    { label: 'Enterprise', value: lifecycle.enterprise },
    { label: 'Pending cancel', value: lifecycle.pendingCancel },
  ];
  return (
    <Card>
      <Stack gap={4}>
        <Heading level={3}>Lifecycle</Heading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <Stack key={item.label} gap={0}>
              <Text className="text-xl font-medium tabular-nums">
                {item.value.toLocaleString('en-US')}
              </Text>
              <Text size="sm" variant="muted">
                {item.label}
              </Text>
            </Stack>
          ))}
        </div>
      </Stack>
    </Card>
  );
}

export function RevenueCard({ revenue }: { revenue: OperatorMetricsRevenue }) {
  return (
    <Card>
      <Stack gap={4}>
        <Heading level={3}>Recurring revenue</Heading>
        <Stack direction="row" gap={2} className="items-baseline">
          <Text className="text-3xl font-medium tracking-tight">
            {formatMoneyCents(revenue.mrrTotalCents)}
          </Text>
          <Text variant="muted">/mo MRR</Text>
        </Stack>
        <div className="grid grid-cols-3 gap-4">
          <Stack gap={0}>
            <Text className="text-lg font-medium tabular-nums">
              {formatMoneyCents(revenue.arrTotalCents)}
            </Text>
            <Text size="sm" variant="muted">
              ARR
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text className="text-lg font-medium tabular-nums">
              {formatMoneyCents(revenue.arpuCents)}
            </Text>
            <Text size="sm" variant="muted">
              ARPU / mo
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text className="text-lg font-medium tabular-nums">
              {revenue.payingTenants.toLocaleString('en-US')}
            </Text>
            <Text size="sm" variant="muted">
              Paying tenants
            </Text>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
}

export function ModulesCard({
  modules,
  showRevenue,
}: {
  modules: OperatorMetricsModule[];
  showRevenue: boolean;
}) {
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Module adoption</Heading>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Adoption</TableHead>
              {showRevenue ? <TableHead className="text-right">MRR</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.key}>
                <TableCell>
                  <ModuleProvider module={moduleColor(m.key)}>
                    <Badge color="module" variant="soft">
                      {moduleLabel(m.key)}
                    </Badge>
                  </ModuleProvider>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Text size="sm">{m.active.toLocaleString('en-US')}</Text>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Text size="sm" variant="muted">
                    {m.adoptionPct}%
                  </Text>
                </TableCell>
                {showRevenue ? (
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm">{formatMoneyCents(m.mrrCents)}/mo</Text>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Stack>
    </Card>
  );
}

export function SignupsCard({ signups }: { signups: OperatorMetricsSignups }) {
  const max = signups.series.reduce((m, p) => Math.max(m, p.count), 0) || 1;
  return (
    <Card>
      <Stack gap={4}>
        <Heading level={3}>Signups</Heading>
        <div className="grid grid-cols-3 gap-4">
          <Stack gap={0}>
            <Text className="text-xl font-medium tabular-nums">
              {signups.total.toLocaleString('en-US')}
            </Text>
            <Text size="sm" variant="muted">
              Last {signups.windowDays} days
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text className="text-xl font-medium tabular-nums">{signups.last30}</Text>
            <Text size="sm" variant="muted">
              Last 30 days
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text className="text-xl font-medium tabular-nums">{signups.last7}</Text>
            <Text size="sm" variant="muted">
              Last 7 days
            </Text>
          </Stack>
        </div>
        <div className="flex h-16 items-end gap-px" aria-hidden>
          {signups.series.map((p) => (
            <div
              key={p.date}
              title={`${p.date}: ${p.count}`}
              style={{ height: `${Math.max(2, (p.count / max) * 100)}%` }}
              className="bg-module min-h-px flex-1 rounded-sm opacity-80"
            />
          ))}
        </div>
      </Stack>
    </Card>
  );
}

export function ChurnCard({ churn }: { churn: OperatorMetricsChurn }) {
  return (
    <Card>
      <Stack gap={4}>
        <Heading level={3}>Churn</Heading>
        <Stack direction="row" gap={2} className="items-baseline">
          <Text className="text-3xl font-medium tracking-tight">{churn.ratePct}%</Text>
          <Text variant="muted">of paid + canceled</Text>
        </Stack>
        <div className="grid grid-cols-2 gap-4">
          <Stack gap={0}>
            <Text className="text-lg font-medium tabular-nums">{churn.canceled}</Text>
            <Text size="sm" variant="muted">
              Canceled
            </Text>
          </Stack>
          <Stack gap={0}>
            <Text className="text-lg font-medium tabular-nums">{churn.pendingCancel}</Text>
            <Text size="sm" variant="muted">
              Pending cancel
            </Text>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
}
