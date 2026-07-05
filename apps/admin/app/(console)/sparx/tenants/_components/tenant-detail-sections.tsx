import {
  Badge,
  Card,
  Heading,
  ModuleProvider,
  statusLabel,
  statusTone,
  Stack,
  Text,
} from '@sparx/ui';
import type {
  OperatorTenantActivity,
  OperatorTenantBilling,
  OperatorTenantDomain,
  OperatorTenantModule,
  OperatorTenantStorage,
} from '@sparx/operator';
import { moduleColor, moduleLabel } from '@/lib/modules';
import { formatBytes, formatDate, formatDateTime, formatMoneyCents } from '@/lib/format';

// The tenant-detail sections — each renders one facet of a tenant's account the
// same way the tenant's own dashboard shows it (representation parity, D7): the
// subscription snapshot mirrors Finance → subscription, module chips wear their
// module hue, and status pills resolve through `statusTone`. All read-only.

const rowClass = 'border-b border-[var(--color-border-default)] pb-2 last:border-0';

/** A label / value pair for compact fact lists. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" align="center" justify="between">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

export function SubscriptionCard({ billing }: { billing: OperatorTenantBilling }) {
  const trialEnds = formatDate(billing.trialEndsAt);
  const nextBilling = formatDate(billing.currentPeriodEnd);
  return (
    <Card>
      <Stack gap={4}>
        <Stack direction="row" align="center" justify="between">
          <Heading level={3}>Subscription</Heading>
          {billing.subscriptionStatus ? (
            <Badge color={statusTone(billing.subscriptionStatus)} variant="soft">
              {statusLabel(billing.subscriptionStatus)}
              {billing.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
            </Badge>
          ) : (
            <Badge variant="soft">No subscription</Badge>
          )}
        </Stack>
        <Stack direction="row" gap={2} className="items-baseline">
          <Text className="text-3xl font-medium tracking-tight">
            {formatMoneyCents(billing.planTotalCents)}
          </Text>
          <Text variant="muted">{billing.billingInterval === 'annual' ? '/yr' : '/mo'}</Text>
        </Stack>
        <Stack gap={1}>
          {billing.planType === 'enterprise' ? (
            <Text size="sm" variant="muted">
              Enterprise plan — custom pricing managed through support.
            </Text>
          ) : null}
          {trialEnds && billing.subscriptionStatus === 'trialing' ? (
            <Text size="sm" variant="muted">
              Free trial ends {trialEnds}.
            </Text>
          ) : nextBilling ? (
            <Text size="sm" variant="muted">
              Next billing {nextBilling}.
            </Text>
          ) : null}
          {!billing.billingActive ? (
            <Text size="sm" variant="muted">
              Billing isn’t live yet — the amount above is what this tenant will pay once its
              modules are billed.
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </Card>
  );
}

export function ModulesCard({ modules }: { modules: OperatorTenantModule[] }) {
  const active = modules.filter((m) => m.enabled);
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Active modules</Heading>
        {active.length === 0 ? (
          <Text variant="muted">No modules active.</Text>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((m) => (
              <ModuleProvider key={m.key} module={moduleColor(m.key)}>
                <Badge color="module" variant="soft">
                  {moduleLabel(m.key)}
                  {m.source === 'bundled'
                    ? ' · included'
                    : m.monthlyCents > 0
                      ? ` · ${formatMoneyCents(m.monthlyCents)}/mo`
                      : ''}
                </Badge>
              </ModuleProvider>
            ))}
          </div>
        )}
      </Stack>
    </Card>
  );
}

export function StorageCard({ storage }: { storage: OperatorTenantStorage }) {
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Storage</Heading>
        <Stack direction="row" gap={2} className="items-baseline">
          <Text className="text-2xl font-medium">{formatBytes(storage.totalBytes)}</Text>
          <Text size="sm" variant="muted">
            across {storage.assetCount} {storage.assetCount === 1 ? 'asset' : 'assets'}
          </Text>
        </Stack>
        <Text size="sm" variant="muted">
          {formatBytes(storage.assetBytes)} originals · {formatBytes(storage.variantBytes)}{' '}
          generated variants
        </Text>
        <Text size="sm" variant="muted">
          Limit:{' '}
          {storage.storageLimitBytes != null
            ? `${formatBytes(storage.storageLimitBytes)} (operator override)`
            : 'No limit set'}
        </Text>
      </Stack>
    </Card>
  );
}

export function AcquisitionCard({
  acquisition,
}: {
  acquisition: {
    channel: string | null;
    source: string | null;
    campaign: string | null;
    acquiredAt: string | null;
  };
}) {
  const { channel, source, campaign, acquiredAt } = acquisition;
  const hasAny = [channel, source, campaign, acquiredAt].some((v) => v != null && v !== '');
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Acquisition</Heading>
        {!hasAny ? (
          <Text variant="muted">No attribution recorded.</Text>
        ) : (
          <Stack gap={2}>
            <Fact label="Channel" value={channel ?? '—'} />
            <Fact label="Source" value={source ?? '—'} />
            <Fact label="Campaign" value={campaign ?? '—'} />
            <Fact label="Acquired" value={formatDate(acquiredAt) ?? '—'} />
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function DomainsCard({ domains }: { domains: OperatorTenantDomain[] }) {
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Domains</Heading>
        {domains.length === 0 ? (
          <Text variant="muted">No domains connected.</Text>
        ) : (
          <Stack gap={2}>
            {domains.map((d) => (
              <Stack
                key={d.host}
                direction="row"
                align="center"
                justify="between"
                className={rowClass}
              >
                <Stack gap={0}>
                  <Text size="sm" className="font-medium">
                    {d.host}
                    {d.isCanonical ? ' · primary' : ''}
                  </Text>
                  <Text size="xs" variant="muted">
                    {d.type}
                  </Text>
                </Stack>
                <Badge color={statusTone(d.status)} variant="soft">
                  {statusLabel(d.status)}
                </Badge>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function ActivityCard({ activity }: { activity: OperatorTenantActivity[] }) {
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Recent activity</Heading>
        {activity.length === 0 ? (
          <Text variant="muted">No recorded activity.</Text>
        ) : (
          <Stack gap={2}>
            {activity.map((a) => (
              <Stack
                key={a.id}
                direction="row"
                align="center"
                justify="between"
                className={rowClass}
              >
                <Stack gap={0}>
                  <Text size="sm" className="font-medium">
                    {a.action}
                  </Text>
                  <Text size="xs" variant="muted">
                    {[a.actorType, a.entityType].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </Stack>
                <Text size="xs" variant="muted">
                  {formatDateTime(a.createdAt)}
                </Text>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
