import Link from 'next/link';
import { Badge, Card, Heading, Stack, Text } from '@sparx/ui';
import { hasCapability, requireOperator } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { OPERATOR_CAPABILITY_LABELS } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';

export default async function ConsoleHome() {
  const operator = await requireOperator();

  // Audit the cross-tenant console view at the action level (§7). Best-effort —
  // a logging failure must never blank the page.
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      action: 'console.view',
    });
  } catch {
    // swallowed — see comment above
  }

  // Prove the api-rest /internal/operator seam end-to-end (the Slice-1 DoD): the
  // admin app authenticates the operator, then reaches api-rest with the shared
  // secret + the operator id, and api-rest echoes it back.
  let apiOk = false;
  let apiDetail: string;
  try {
    const res = await operatorApi().whoami(operator.id);
    apiOk = res.ok && res.operatorId === operator.id;
    apiDetail = apiOk
      ? `api-rest echoed operator ${res.operatorId} at ${res.time}`
      : `Unexpected response (operatorId=${res.operatorId ?? 'null'})`;
  } catch (err) {
    apiDetail = err instanceof Error ? err.message : 'api-rest unreachable';
  }

  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Heading level={1}>Operator console</Heading>
        <Text variant="muted">
          Signed in as {operator.email}. Tenant management, platform metrics, billing operations,
          domain management, and support tools are live below; feedback triage arrives in a later
          slice.
        </Text>
      </Stack>

      {hasCapability(operator, 'support:read') ||
      hasCapability(operator, 'billing:read') ||
      hasCapability(operator, 'domain:manage') ? (
        <div className="grid gap-4 md:grid-cols-2">
          {hasCapability(operator, 'support:read') ? (
            <>
              <ConsoleEntry
                title="Tenants"
                href="/sparx/tenants"
                cta="View tenants →"
                body="Browse every account on the platform and open one to see its subscription, active modules, storage, domains, and recent activity — read-only."
              />
              <ConsoleEntry
                title="Metrics"
                href="/sparx/metrics"
                cta="View metrics →"
                body="Cross-tenant platform health — lifecycle, recurring revenue, module adoption, signups, and churn across every account."
              />
              <ConsoleEntry
                title="Support"
                href="/sparx/support"
                cta="Open support →"
                body="Look up any order or customer across every tenant, re-send an order confirmation, and manage a tenant’s search index and email delivery log."
              />
            </>
          ) : null}
          {hasCapability(operator, 'billing:read') ? (
            <ConsoleEntry
              title="Billing"
              href="/sparx/billing"
              cta="View billing →"
              body="Failed-payment queue, platform coupons, and the Stripe event feed. Refunds and enterprise invoices live on each tenant’s billing tab."
            />
          ) : null}
          {hasCapability(operator, 'domain:manage') ? (
            <ConsoleEntry
              title="Domains"
              href="/sparx/domains"
              cta="View domains →"
              body="Every custom and sparx-purchased domain across the platform — routing status, SSL readiness, live DNS diagnostics, registration history, and a force re-verify."
            />
          ) : null}
        </div>
      ) : null}

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Your capabilities</Heading>
          {operator.capabilities.length === 0 ? (
            <Text variant="muted">
              No capabilities granted yet — ask a super admin to grant access.
            </Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {operator.capabilities.map((capability) => (
                <Badge key={capability} color="primary" variant="soft">
                  {OPERATOR_CAPABILITY_LABELS[capability]}
                </Badge>
              ))}
            </div>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={2}>
          <Stack direction="row" align="center" justify="between">
            <Heading level={3}>api-rest connectivity</Heading>
            <Badge color={apiOk ? 'success' : 'danger'} variant="soft">
              {apiOk ? 'Connected' : 'Unavailable'}
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {apiDetail}
          </Text>
          <Text size="xs" variant="muted">
            All cross-tenant data flows through this internal seam — the console holds no tenant
            database access of its own.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

/** A console home entry-point card (title + blurb + link). */
function ConsoleEntry({
  title,
  href,
  cta,
  body,
}: {
  title: string;
  href: string;
  cta: string;
  body: string;
}) {
  return (
    <Card>
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3}>{title}</Heading>
          <Text size="sm" variant="muted">
            {body}
          </Text>
        </Stack>
        <Link
          href={href}
          className="text-sm font-medium text-[var(--module-active-text)] hover:underline"
        >
          {cta}
        </Link>
      </Stack>
    </Card>
  );
}
