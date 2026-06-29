// Finance → Payouts (docs/110 Slice 3) — "where your money lands." One screen for
// every way sparx pays a merchant out: the sparx Pay (Stripe Connect) balance for
// their own store sales, and the sparx.market weekly settlement + ACH bank account
// for marketplace sales. Both rails are part of the Commerce module, so the page is
// gated on Commerce and tinted with the Commerce hue (color-follows-functionality).
// Marketplace participation, profile, and listings stay in Settings → sparx.market
// (docs/109 §5); only the money lives here.

import Link from 'next/link';
import { Banknote } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getSparxPayBalance } from '../payments/actions';
import {
  getMarketEnabled,
  getMarketPayoutAccount,
  getMarketSettlementRuns,
  getMarketSettlementSummary,
} from './actions';
import { SparxPayBalanceCard } from './_components/sparx-pay-balance-card';
import { SettlementPanel } from './_components/settlement-panel';
import { PayoutAccountCard } from './_components/payout-account-card';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

  const [balance, marketEnabled] = await Promise.all([getSparxPayBalance(), getMarketEnabled()]);

  // The marketplace settlement reads only matter for an enrolled seller — a tenant
  // who hasn't joined sparx.market has no settlement, no payout account, and gets the
  // "join" pointer instead of empty panels.
  const [account, summary, runs] = marketEnabled
    ? await Promise.all([
        getMarketPayoutAccount(),
        getMarketSettlementSummary(),
        getMarketSettlementRuns(),
      ])
    : [null, null, []];

  return (
    <ModuleProvider module="commerce">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Banknote className="h-5 w-5" />}
            title="Payouts"
            description="Where your money lands. sparx Pay settles your own store sales to your bank on a schedule; sparx.market pays your marketplace earnings weekly by ACH."
          />

          <SparxPayBalanceCard balance={balance} />

          {marketEnabled ? (
            <>
              <SettlementPanel summary={summary} runs={runs} />
              <Card variant="module">
                <CardHeader>
                  <CardTitle>Marketplace payout account</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayoutAccountCard account={account} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card variant="module">
              <CardHeader>
                <CardTitle>sparx.market earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={3}>
                  <Text size="sm" variant="muted" className="max-w-prose">
                    Join sparx.market — the first-party marketplace — to earn an additional sales
                    channel. sparx handles checkout as merchant-of-record and pays you weekly, minus
                    commission. Your settlement history and payout bank account will appear here
                    once you join.
                  </Text>
                  <div>
                    <Button asChild color="module">
                      <Link href="/commerce/market">Join sparx.market</Link>
                    </Button>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
