// Billing settings (docs/67 §5) — plan snapshot + a door to the Stripe Customer
// Portal. The plan is derived from the tenant's active modules, so this page is
// meaningful even before the platform billing ops (Stripe products, price IDs,
// webhook) are live; once they are, status + the portal light up.

import { CreditCard } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { getBillingState } from './actions';
import { ManageBillingButton } from './_components/manage-billing-button';
import { TrialStatusBanner } from './_components/trial-status-banner';
import { EnterprisePlanCard } from './_components/enterprise-plan-card';

export const dynamic = 'force-dynamic';

const MODULE_LABELS: Record<string, string> = {
  builder: 'Builder',
  commerce: 'Commerce',
  cms: 'CMS',
  crm: 'CRM',
  email: 'Email',
  b2b: 'B2B · Fleet',
  ai: 'AI · MCP',
  dropship: 'Dropship',
  invoicing: 'Invoicing',
  chat: 'Live Chat',
};

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  unpaid: 'danger',
  canceled: 'danger',
  paused: 'outline',
};

function money(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString() : null;
}

export default async function BillingSettingsPage() {
  const session = await requireSession();
  const state = await getBillingState();
  const canManage = session.user.role === 'owner' || session.user.role === 'admin';

  const status = state.subscriptionStatus;
  const trialEnds = formatDate(state.trialEndsAt);
  const nextBilling = formatDate(state.currentPeriodEnd);
  const intervalLabel = state.billingInterval === 'annual' ? '/yr' : '/mo';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Billing"
          description="Pay only for the modules you activate. Manage your payment method, switch monthly or annual, download invoices, and cancel anytime through the secure Stripe portal."
        />

        <TrialStatusBanner state={state} canManage={canManage} />

        {state.planType === 'enterprise' ? (
          <EnterprisePlanCard canManage={canManage} billingActive={state.billingActive} />
        ) : (
          <>
            {!state.configured || !state.billingActive ? (
              <Card>
                <CardContent>
                  <Stack gap={1} className="py-1">
                    <Text weight="medium">
                      {state.configured
                        ? 'No active subscription yet'
                        : 'Billing isn’t switched on for this workspace yet'}
                    </Text>
                    <Text size="sm" variant="muted">
                      Modules activate freely for now — you won’t be charged until billing goes
                      live. The plan below is what you’ll pay then, based on the modules you have on
                      today.
                    </Text>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <Stack direction="row" align="center" gap={3} className="justify-between">
                  <CardTitle>Your plan</CardTitle>
                  {status ? (
                    <Badge color={STATUS_BADGE[status] ?? 'outline'} variant="soft">
                      {status.replace('_', ' ')}
                      {state.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                    </Badge>
                  ) : null}
                </Stack>
              </CardHeader>
              <CardContent>
                <Stack gap={5}>
                  <Stack direction="row" align="center" gap={2} className="items-baseline">
                    <Text className="text-5xl font-medium tracking-tight">
                      {money(state.planTotalCents)}
                    </Text>
                    <Text size="lg" variant="muted">
                      {intervalLabel}
                    </Text>
                  </Stack>

                  {trialEnds && status === 'trialing' ? (
                    <Text size="sm" variant="muted">
                      Free trial ends {trialEnds}.
                    </Text>
                  ) : nextBilling ? (
                    <Text size="sm" variant="muted">
                      Next billing date {nextBilling}.
                    </Text>
                  ) : null}

                  <Stack gap={2}>
                    {state.planModules.length === 0 ? (
                      <Text size="sm" variant="muted">
                        No billable modules active. Turn one on from Settings → Modules.
                      </Text>
                    ) : (
                      state.planModules.map((m) => (
                        <Stack
                          key={m.moduleKey}
                          direction="row"
                          align="center"
                          className="justify-between border-b border-[var(--color-border-subtle)] pb-2 last:border-0"
                        >
                          <Text size="sm">{MODULE_LABELS[m.moduleKey] ?? m.moduleKey}</Text>
                          <Text size="sm" weight="medium" className="tabular-nums">
                            {money(m.monthlyCents)}
                            {intervalLabel}
                          </Text>
                        </Stack>
                      ))
                    )}
                  </Stack>

                  <Text size="xs" variant="muted">
                    Invoicing is included free with Commerce or B2B, so it never appears as a line
                    item. One invoice covers everything.
                  </Text>

                  {canManage ? (
                    <div>
                      <ManageBillingButton disabled={!state.configured || !state.billingActive} />
                      {!state.billingActive ? (
                        <Text size="xs" variant="muted" className="mt-2">
                          The portal opens once a subscription exists.
                        </Text>
                      ) : null}
                    </div>
                  ) : (
                    <Text size="sm" variant="muted">
                      Only owners and admins can manage billing.
                    </Text>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  );
}
