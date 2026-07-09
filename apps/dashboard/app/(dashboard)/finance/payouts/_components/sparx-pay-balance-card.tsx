// sparx Pay payout balance (docs/110 Slice 3, GAP A) — the money that has settled to
// the merchant's Stripe Connect account: available (ready to pay out) + settling
// (clearing from recent sales), with the account's payout cadence. Server component;
// the only interactive bit (the Stripe-hosted dashboard link) is its own client button.

import Link from 'next/link';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { Stat, statusLabel } from '@sparx/ui';

import { formatMoney } from '../_format';
import type { SparxPayBalance } from '../../payments/actions';
import { OpenDashboardButton } from './open-dashboard-button';

export function SparxPayBalanceCard({ balance }: { balance: SparxPayBalance | null }) {
  const cadence =
    balance?.payoutInterval && balance.payoutInterval !== 'manual'
      ? `${statusLabel(balance.payoutInterval)} payouts`
      : null;

  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>sparx Pay balance</CardTitle>
          {cadence && (
            <Badge color="neutral" variant="soft" size="sm">
              {cadence}
            </Badge>
          )}
        </div>

        {balance ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Stat
                label="Available"
                value={formatMoney(balance.availableCents, balance.currency)}
                hint="Ready to pay out"
              />
              <Stat
                label="Settling"
                value={formatMoney(balance.pendingCents, balance.currency)}
                hint="Clearing from recent sales"
              />
            </div>
            <div className="flex flex-col gap-2">
              <OpenDashboardButton />
              <p className="text-base-content/70 max-w-prose text-xs">
                Manage your bank account, payout schedule, and full payout history in the secure
                Stripe-hosted dashboard.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base-content/70 max-w-prose text-sm">
              No sparx Pay balance yet. Once you finish setup and take your first payment, your
              available and settling balances show here — sparx handles settlement and pays out to
              your bank automatically.
            </p>
            <div>
              <Button color="module" render={<Link href="/finance/payments" />}>
                Set up sparx Pay
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
