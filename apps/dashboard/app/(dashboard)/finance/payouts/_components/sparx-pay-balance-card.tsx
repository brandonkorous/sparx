// sparx Pay payout balance (docs/110 Slice 3, GAP A) — the money that has settled to
// the merchant's Stripe Connect account: available (ready to pay out) + settling
// (clearing from recent sales), with the account's payout cadence. Server component;
// the only interactive bit (the Stripe-hosted dashboard link) is its own client button.

import Link from 'next/link';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Stack,
  Stat,
  Text,
  statusLabel,
} from '@sparx/ui';

import { formatMoney } from '../_format';
import type { SparxPayBalance } from '../../payments/actions';
import { OpenDashboardButton } from './open-dashboard-button';

export function SparxPayBalanceCard({ balance }: { balance: SparxPayBalance | null }) {
  const cadence =
    balance?.payoutInterval && balance.payoutInterval !== 'manual'
      ? `${statusLabel(balance.payoutInterval)} payouts`
      : null;

  return (
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={2} wrap>
          <CardTitle>sparx Pay balance</CardTitle>
          {cadence && (
            <Badge color="neutral" variant="soft" size="sm">
              {cadence}
            </Badge>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        {balance ? (
          <Stack gap={5}>
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
            <Stack gap={2}>
              <OpenDashboardButton />
              <Text size="xs" variant="muted" className="max-w-prose">
                Manage your bank account, payout schedule, and full payout history in the secure
                Stripe-hosted dashboard.
              </Text>
            </Stack>
          </Stack>
        ) : (
          <Stack gap={3}>
            <Text size="sm" variant="muted" className="max-w-prose">
              No sparx Pay balance yet. Once you finish setup and take your first payment, your
              available and settling balances show here — sparx handles settlement and pays out to
              your bank automatically.
            </Text>
            <Link
              href="/finance/payments"
              className="text-sm font-medium text-[var(--module-active-text)] hover:underline"
            >
              Set up sparx Pay →
            </Link>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
