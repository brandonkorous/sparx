'use client';

// sparx Pay hero — the recommended default, always shown at the top of Payments. One
// card that adapts to onboarding state: not started → "Set up"; submitted/pending →
// "Continue"; charges enabled → live status + payouts. Stripe Connect Express runs the
// hosted onboarding (docs/94 §6); we only ever show status + the next action.

import * as React from 'react';
import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardBody } from 'silicaui-react';
import { toast } from '@sparx/ui';

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
    <Card className="border-base-content/30">
      <CardBody>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <GatewayMark gatewayId="sparx_pay" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium">sparx Pay</p>
                <Badge color="module" variant="soft">
                  Recommended
                </Badge>
                {statusBadge}
              </div>
              <p className="text-base-content/70 text-sm">
                Accept cards in minutes — sparx handles disputes, settlement, PCI, and payouts to
                your bank. Flat 0.5% per transaction, no monthly fee.
              </p>
            </div>
          </div>

          {chargesEnabled ? (
            <div className="flex flex-wrap gap-2">
              <StatusChip on={chargesEnabled} label="Charges" />
              <StatusChip on={payoutsEnabled} label="Payouts" />
              <StatusChip on={detailsSubmitted} label="Details verified" />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {!accountId ? (
              <Button
                type="button"
                color="module"
                onClick={onboard}
                loading={pending}
                iconEnd={<ArrowRight className="h-4 w-4" />}
              >
                Set up sparx Pay
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
                  iconEnd={<ExternalLink className="h-4 w-4" />}
                >
                  Manage payouts
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
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function StatusChip({ on, label }: { on: boolean; label: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={on ? 'text-success h-4 w-4' : 'text-base-content/50 h-4 w-4'} />
      <p className={on ? 'text-sm' : 'text-base-content/70 text-sm'}>{label}</p>
    </div>
  );
}
