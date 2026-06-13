'use client';

// Settings → Payments (docs/94 ADR §13). Pick a gateway and drive Stripe's hosted
// Connect flows. We render no onboarding or account UI — "Set up" and "Manage payouts"
// redirect to Stripe-hosted pages (Stripe-hosted-first). Sparx Pay status is pulled
// live (and re-synced when the merchant returns from onboarding).

import * as React from 'react';
import { Banknote, CheckCircle2, CreditCard, ExternalLink, Wallet } from 'lucide-react';
import { Badge, Button, Card, CardContent, Stack, Text, cn, toast } from '@sparx/ui';

import {
  type PaymentConfigState,
  type PaymentGatewayId,
  openSparxPayDashboard,
  refreshSparxPayStatus,
  selectGateway,
  startSparxPayOnboarding,
} from '../actions';

const GATEWAYS: {
  id: PaymentGatewayId;
  name: string;
  icon: typeof Wallet;
  tagline?: string;
  blurb: string;
}[] = [
  {
    id: 'sparx_pay',
    name: 'Sparx Pay',
    icon: Wallet,
    tagline: 'Recommended',
    blurb:
      'Accept cards in minutes. Sparx handles disputes, settlement, and PCI. Flat 0.5% per transaction — no monthly fee.',
  },
  {
    id: 'stripe_direct',
    name: 'Your own Stripe',
    icon: CreditCard,
    blurb:
      'Route checkout to your own Stripe account. No Sparx fee — you own disputes, PCI, and payouts.',
  },
  {
    id: 'manual',
    name: 'Manual payments',
    icon: Banknote,
    blurb:
      'Record check, cash, wire, or ACH by hand. No online payments and no fee — you mark orders and invoices paid.',
  },
];

export function PaymentsManager({
  initialConfig,
}: {
  initialConfig: PaymentConfigState;
}): React.JSX.Element {
  const [config, setConfig] = React.useState(initialConfig);
  const [pending, startTransition] = React.useTransition();

  // When the merchant returns from hosted onboarding, pull the live status once so the
  // panel reflects charges-enabled without a manual refresh.
  React.useEffect(() => {
    const needsSync =
      config.gatewayId === 'sparx_pay' && config.sparxPay.accountId !== null && !config.isActive;
    if (!needsSync) return;
    let cancelled = false;
    void refreshSparxPayStatus()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        /* best-effort sync */
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(gatewayId: PaymentGatewayId): void {
    if (gatewayId === config.gatewayId || pending) return;
    startTransition(async () => {
      try {
        setConfig(await selectGateway(gatewayId));
      } catch {
        toast.error('Could not switch payment method');
      }
    });
  }

  return (
    <Stack gap={6}>
      <Stack gap={3}>
        {GATEWAYS.map((g) => {
          const selected = config.gatewayId === g.id;
          const Icon = g.icon;
          return (
            <Card
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => choose(g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  choose(g.id);
                }
              }}
              className={cn(
                'cursor-pointer transition-shadow',
                selected && 'ring-2 ring-[var(--color-module-base)]',
                pending && 'pointer-events-none opacity-70'
              )}
            >
              <CardContent>
                <Stack direction="row" align="start" gap={4} className="py-1">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-module-base)]" />
                  <Stack gap={1} className="min-w-0 flex-1">
                    <Stack direction="row" align="center" gap={2}>
                      <Text weight="medium">{g.name}</Text>
                      {g.tagline ? (
                        <Badge color="module" variant="soft">
                          {g.tagline}
                        </Badge>
                      ) : null}
                    </Stack>
                    <Text size="sm" variant="muted">
                      {g.blurb}
                    </Text>
                  </Stack>
                  {selected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-module-base)]" />
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {config.gatewayId === 'sparx_pay' ? (
        <SparxPayPanel config={config} onChange={setConfig} />
      ) : null}

      {config.gatewayId === 'stripe_direct' ? (
        <Card>
          <CardContent>
            <Stack gap={2} className="py-1">
              <Text weight="medium">Connect your Stripe account</Text>
              <Text size="sm" variant="muted">
                Your Stripe secret key and webhook signing secret are stored securely and are
                provisioned during setup. Point your Stripe webhook at{' '}
                <code className="rounded bg-[var(--color-surface-sunken)] px-1 py-0.5 text-xs">
                  /v1/public/webhooks/stripe-direct/&lt;your-tenant-id&gt;
                </code>
                . Sparx takes no fee on this path.
              </Text>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {config.gatewayId === 'manual' ? (
        <Card>
          <CardContent>
            <Stack gap={2} className="py-1">
              <Text weight="medium">Manual payments are on</Text>
              <Text size="sm" variant="muted">
                Online checkout won’t collect a card. You record each payment against its order or
                invoice. No transaction fee applies.
              </Text>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

function SparxPayPanel({
  config,
  onChange,
}: {
  config: PaymentConfigState;
  onChange: (next: PaymentConfigState) => void;
}): React.JSX.Element {
  const [pending, startTransition] = React.useTransition();
  const { accountId, chargesEnabled, payoutsEnabled, detailsSubmitted } = config.sparxPay;

  function onboard(): void {
    startTransition(async () => {
      const base = `${window.location.origin}/settings/payments`;
      const res = await startSparxPayOnboarding(
        `${base}?onboarding=complete`,
        `${base}?onboarding=refresh`
      );
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      toast.error('Couldn’t start onboarding', { description: res.error });
    });
  }

  function dashboard(): void {
    startTransition(async () => {
      const res = await openSparxPayDashboard();
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      toast.error('Couldn’t open dashboard', { description: res.error });
    });
  }

  function refresh(): void {
    startTransition(async () => {
      try {
        onChange(await refreshSparxPayStatus());
      } catch {
        toast.error('Couldn’t refresh status');
      }
    });
  }

  // Not started.
  if (!accountId) {
    return (
      <Card>
        <CardContent>
          <Stack gap={4} className="py-1">
            <Stack gap={1}>
              <Text weight="medium">Set up Sparx Pay</Text>
              <Text size="sm" variant="muted">
                Stripe hosts a short onboarding — business details, bank account, and identity.
                Takes about five minutes. You’ll come right back here when it’s done.
              </Text>
            </Stack>
            <div>
              <Button
                type="button"
                color="module"
                variant="solid"
                onClick={onboard}
                loading={pending}
              >
                Set up Sparx Pay
              </Button>
            </div>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Active — charges enabled.
  if (chargesEnabled) {
    return (
      <Card>
        <CardContent>
          <Stack gap={4} className="py-1">
            <Stack direction="row" align="center" gap={2} className="justify-between">
              <Text weight="medium">Sparx Pay is active</Text>
              <Badge color="success" variant="soft">
                Accepting payments
              </Badge>
            </Stack>
            <Stack direction="row" gap={2} className="flex-wrap">
              <StatusChip on={chargesEnabled} label="Charges enabled" />
              <StatusChip on={payoutsEnabled} label="Payouts enabled" />
              <StatusChip on={detailsSubmitted} label="Details submitted" />
            </Stack>
            <Stack direction="row" gap={3} className="flex-wrap">
              <Button
                type="button"
                color="module"
                variant="solid"
                onClick={dashboard}
                loading={pending}
              >
                Manage payouts
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                type="button"
                color="module"
                variant="outline"
                onClick={refresh}
                loading={pending}
              >
                Refresh status
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // In progress — account created, not yet charging.
  return (
    <Card>
      <CardContent>
        <Stack gap={4} className="py-1">
          <Stack direction="row" align="center" gap={2} className="justify-between">
            <Text weight="medium">Finish setting up Sparx Pay</Text>
            <Badge color="warning" variant="soft">
              In progress
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {detailsSubmitted
              ? 'Stripe is reviewing your details. This usually clears within a few minutes.'
              : 'Your onboarding isn’t complete yet. Pick up where you left off.'}
          </Text>
          <Stack direction="row" gap={3} className="flex-wrap">
            <Button
              type="button"
              color="module"
              variant="solid"
              onClick={onboard}
              loading={pending}
            >
              Continue setup
            </Button>
            <Button
              type="button"
              color="module"
              variant="outline"
              onClick={refresh}
              loading={pending}
            >
              Refresh status
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatusChip({ on, label }: { on: boolean; label: string }): React.JSX.Element {
  return (
    <Badge color={on ? 'success' : 'neutral'} variant="soft">
      {label}
    </Badge>
  );
}
