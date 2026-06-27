'use client';

// Finance → Payments (docs/94 + docs/111). The payment-acceptance door, rendered from
// the gateway CATALOG: sparx Pay (recommended, hosted Connect onboarding), the
// merchant's own Stripe, Square / Authorize.net / 1stPayGateway / a custom gateway
// (bring-your-own, API keys captured + encrypted), and manual. Picking a gateway sets
// it active; an api-key gateway shows a credential form generated from its schema. We
// render no card form here — sparx Pay + Stripe confirm inline via Elements; the
// bring-your-own gateways send shoppers to the vendor's hosted page (SAQ-A).

import * as React from 'react';
import Link from 'next/link';
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  Globe,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Stack, Text, cn, toast } from '@sparx/ui';

import {
  type GatewayDescriptor,
  type MaskedGatewayCredential,
  type PaymentConfigState,
  type PaymentGatewayId,
  openSparxPayDashboard,
  refreshSparxPayStatus,
  selectGateway,
  startSparxPayOnboarding,
} from '../actions';
import { GatewayCredentialForm } from './gateway-credential-form';

const GATEWAY_ICON: Record<string, typeof Wallet> = {
  sparx_pay: Wallet,
  stripe_direct: CreditCard,
  square: CircleDollarSign,
  authorize_net: CreditCard,
  first_pay: CreditCard,
  custom: Globe,
  manual: Banknote,
};

export function PaymentsManager({
  initialConfig,
  catalog,
  credentials,
}: {
  initialConfig: PaymentConfigState;
  catalog: GatewayDescriptor[];
  credentials: MaskedGatewayCredential[];
}): React.JSX.Element {
  const [config, setConfig] = React.useState(initialConfig);
  const [pending, startTransition] = React.useTransition();
  const credByGateway = React.useMemo(
    () => new Map(credentials.map((c) => [c.gatewayId, c])),
    [credentials]
  );

  // When the merchant returns from sparx Pay hosted onboarding, pull live status once.
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

  function isConnected(g: GatewayDescriptor): boolean {
    if (g.onboarding === 'manual') return true;
    if (g.onboarding === 'api_keys') return credByGateway.get(g.id)?.status === 'active';
    return g.id === config.gatewayId && config.isActive; // sparx Pay
  }

  const active = catalog.find((g) => g.id === config.gatewayId);

  return (
    <Stack gap={6}>
      <Stack gap={3}>
        {catalog.map((g) => {
          const selected = config.gatewayId === g.id;
          const Icon = GATEWAY_ICON[g.id] ?? CreditCard;
          const connected = isConnected(g);
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
                    <Stack direction="row" align="center" gap={2} wrap>
                      <Text weight="medium">{g.name}</Text>
                      {g.tagline ? (
                        <Badge color="module" variant="soft">
                          {g.tagline}
                        </Badge>
                      ) : null}
                      {connected ? (
                        <Badge color="success" variant="soft">
                          Connected
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

      {active?.onboarding === 'sparx_hosted' ? (
        <SparxPayPanel config={config} onChange={setConfig} />
      ) : null}

      {active?.onboarding === 'api_keys' ? (
        <Card>
          <CardContent>
            <Stack gap={4} className="py-1">
              <Text weight="medium">Connect {active.name}</Text>
              <GatewayCredentialForm
                descriptor={active}
                credential={credByGateway.get(active.id)}
              />
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {active?.id === 'manual' ? (
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

      <PayPalConnectCard />
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
      const base = `${window.location.origin}/finance/payments`;
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

  if (!accountId) {
    return (
      <Card>
        <CardContent>
          <Stack gap={4} className="py-1">
            <Stack gap={1}>
              <Text weight="medium">Set up sparx Pay</Text>
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
                Set up sparx Pay
              </Button>
            </div>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (chargesEnabled) {
    return (
      <Card>
        <CardContent>
          <Stack gap={4} className="py-1">
            <Stack direction="row" align="center" gap={2} className="justify-between">
              <Text weight="medium">sparx Pay is active</Text>
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

  return (
    <Card>
      <CardContent>
        <Stack gap={4} className="py-1">
          <Stack direction="row" align="center" gap={2} className="justify-between">
            <Text weight="medium">Finish setting up sparx Pay</Text>
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

// PayPal — re-homed into the Payments door (docs/110 Slice 5). It isn't a selectable
// gateway yet (the full PayPal gateway is wired on demand, ADR 94 §12), so it connects
// through the existing provider-install flow rather than the gateway picker above.
function PayPalConnectCard(): React.JSX.Element {
  return (
    <Stack gap={3}>
      <Text size="sm" weight="medium" className="text-[var(--color-text-secondary)]">
        More ways to accept payments
      </Text>
      <Card>
        <CardContent>
          <Stack direction="row" align="start" gap={4} className="py-1">
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-text-tertiary)]" />
            <Stack gap={1} className="min-w-0 flex-1">
              <Text weight="medium">PayPal</Text>
              <Text size="sm" variant="muted">
                Connect your PayPal Business account to accept PayPal and card payments. sparx
                routes checkout to PayPal; you manage your money in PayPal.
              </Text>
            </Stack>
            <Button color="module" variant="outline" size="sm" asChild>
              <Link href="/commerce/providers/install?slug=paypal&kind=payment">
                Connect PayPal
              </Link>
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
