// sparx subscription (docs/67 §5, docs/109 §4) — the "you pay sparx" side of Finance:
// a plan snapshot + a door to the Stripe Customer Portal. The plan is derived from the
// tenant's active modules, so this page is meaningful even before the platform billing
// ops (Stripe products, price IDs, webhook) are live; once they are, status + the
// portal light up. Lives under Finance, not Settings (docs/110 Slice 4a) — wears the
// Finance hue like the rest of the hub (never a commerce hue — money OUT to sparx).

import { CreditCard } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

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

// silica's `outline` is a variant, not a color — a paused/unknown plan reads as a
// neutral soft badge (the whole set renders `variant="soft"`).
const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  unpaid: 'danger',
  canceled: 'danger',
  paused: 'neutral',
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
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<CreditCard className="h-5 w-5" />}
            title="sparx subscription"
            description="What you pay sparx — one bill for every module you activate. Manage your payment method, switch monthly or annual, download invoices, and cancel anytime through the secure Stripe portal."
          />

          <TrialStatusBanner state={state} canManage={canManage} />

          {state.planType === 'enterprise' ? (
            <EnterprisePlanCard canManage={canManage} billingActive={state.billingActive} />
          ) : (
            <>
              {!state.configured || !state.billingActive ? (
                <Card>
                  <CardBody>
                    <p className="font-medium">
                      {state.configured
                        ? 'No active subscription yet'
                        : 'Billing isn’t switched on for this workspace yet'}
                    </p>
                    <p className="text-base-content text-sm">
                      Modules activate freely for now — you won’t be charged until billing goes
                      live. The plan below is what you’ll pay then, based on the modules you have on
                      today.
                    </p>
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardBody>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Your plan</CardTitle>
                    {status ? (
                      <Badge color={STATUS_BADGE[status] ?? 'neutral'} variant="soft">
                        {status.replace('_', ' ')}
                        {state.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="flex items-baseline gap-2">
                      <p className="text-5xl font-medium tracking-tight">
                        {money(state.planTotalCents)}
                      </p>
                      <p className="text-base-content text-lg">{intervalLabel}</p>
                    </div>

                    {trialEnds && status === 'trialing' ? (
                      <p className="text-base-content text-sm">Free trial ends {trialEnds}.</p>
                    ) : nextBilling ? (
                      <p className="text-base-content text-sm">Next billing date {nextBilling}.</p>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      {state.planModules.length === 0 ? (
                        <p className="text-base-content text-sm">
                          No billable modules active. Turn one on from Settings → Modules.
                        </p>
                      ) : (
                        state.planModules.map((m) => (
                          <div
                            key={m.moduleKey}
                            className="border-base-200 flex items-center justify-between border-b pb-2 last:border-0"
                          >
                            <p className="text-sm">{MODULE_LABELS[m.moduleKey] ?? m.moduleKey}</p>
                            <p className="text-sm font-medium tabular-nums">
                              {money(m.monthlyCents)}
                              {intervalLabel}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <p className="text-base-content text-xs">
                      Invoicing is included free with Commerce or B2B, so it never appears as a line
                      item. One invoice covers everything.
                    </p>

                    {canManage ? (
                      <div>
                        <ManageBillingButton disabled={!state.configured || !state.billingActive} />
                        {!state.billingActive ? (
                          <p className="text-base-content mt-2 text-xs">
                            The portal opens once a subscription exists.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-base-content text-sm">
                        Only owners and admins can manage billing.
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </ModuleProvider>
  );
}
