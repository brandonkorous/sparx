'use client';

// sparx Pay hero — the recommended default, always shown at the top of Payments. One
// card that adapts to onboarding state: not started → "Set up"; submitted/pending →
// "Continue"; charges enabled → live status + payouts. Stripe Connect Express runs the
// hosted onboarding (docs/94 §6); we only ever show status + the next action.

import * as React from 'react';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardContent, Stack, Text, toast } from '@sparx/ui';

import {
  type PaymentConfigState,
  openSparxPayDashboard,
  refreshSparxPayStatus,
  startSparxPayOnboarding,
} from '../actions';
import { GatewayMark } from './gateway-mark';

export function SparxPayHero({
  config,
  active,
  onConfigChange,
  onActivate,
}: {
  config: PaymentConfigState;
  active: boolean;
  onConfigChange: (next: PaymentConfigState) => void;
  onActivate: () => void;
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
        onConfigChange(await refreshSparxPayStatus());
      } catch {
        toast.error('Couldn’t refresh status');
      }
    });
  }

  const statusBadge = active ? (
    <Badge color="success" variant="soft">
      Active
    </Badge>
  ) : chargesEnabled ? (
    <Badge color="success" variant="soft">
      Ready
    </Badge>
  ) : accountId ? (
    <Badge color="warning" variant="soft">
      Finish setup
    </Badge>
  ) : null;

  return (
    <Card className="border-[var(--color-border-strong)]">
      <CardContent>
        <Stack gap={5} className="py-1">
          <Stack direction="row" align="start" gap={4}>
            <GatewayMark gatewayId="sparx_pay" size="lg" />
            <Stack gap={1} className="min-w-0 flex-1">
              <Stack direction="row" align="center" gap={2} wrap>
                <Text size="lg" weight="medium">
                  sparx Pay
                </Text>
                <Badge color="module" variant="soft">
                  Recommended
                </Badge>
                {statusBadge}
              </Stack>
              <Text size="sm" variant="muted">
                Accept cards in minutes — sparx handles disputes, settlement, PCI, and payouts to
                your bank. Flat 0.5% per transaction, no monthly fee.
              </Text>
            </Stack>
          </Stack>

          {chargesEnabled ? (
            <Stack direction="row" gap={2} wrap>
              <StatusChip on={chargesEnabled} label="Charges" />
              <StatusChip on={payoutsEnabled} label="Payouts" />
              <StatusChip on={detailsSubmitted} label="Details verified" />
            </Stack>
          ) : null}

          <Stack direction="row" gap={3} wrap>
            {!accountId ? (
              <Button type="button" color="module" onClick={onboard} loading={pending}>
                Set up sparx Pay
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : !chargesEnabled ? (
              <>
                <Button type="button" color="module" onClick={onboard} loading={pending}>
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
              </>
            ) : (
              <>
                {!active ? (
                  <Button type="button" color="module" onClick={onActivate}>
                    Use sparx Pay
                  </Button>
                ) : null}
                <Button
                  type="button"
                  color="module"
                  variant={active ? 'solid' : 'outline'}
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
                  Refresh
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatusChip({ on, label }: { on: boolean; label: string }): React.JSX.Element {
  return (
    <Stack direction="row" align="center" gap={2}>
      <CheckCircle2
        className={
          on
            ? 'h-4 w-4 text-[var(--color-success-text)]'
            : 'h-4 w-4 text-[var(--color-text-tertiary)]'
        }
      />
      <Text size="sm" variant={on ? 'default' : 'muted'}>
        {label}
      </Text>
    </Stack>
  );
}
