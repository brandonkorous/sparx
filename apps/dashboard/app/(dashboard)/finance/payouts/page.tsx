// Finance → Payouts (docs/110 Slice 3) — "where your money lands." One screen for
// every way sparx pays a merchant out: the sparx Pay (Stripe Connect) balance for
// their own store sales, and the sparx.market weekly settlement + ACH bank account
// for marketplace sales. Both rails are part of the Commerce module, so the page is
// gated on Commerce but wears the Finance hue (Finance owns its color — docs/109).
// Marketplace participation, profile, and listings live in Commerce → sparx.market
// (docs/109 §5); only the money lives here.

import Link from 'next/link';
import { Banknote } from 'lucide-react';
import { Button, Card, CardBody, CardTitle } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

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
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Banknote className="h-5 w-5" />}
            title="Payouts"
            description="Where your money lands. sparx Pay settles your own store sales to your bank on a schedule; sparx.market pays your marketplace earnings weekly by ACH."
          />

          <SparxPayBalanceCard balance={balance} />

          {marketEnabled ? (
            <>
              <SettlementPanel summary={summary} runs={runs} />
              {/* Neutral — the sparx Pay balance card above is this page's single
                  finance-tinted (primary) card; the rest stay plain. */}
              <Card>
                <CardBody>
                  <CardTitle>Marketplace payout account</CardTitle>
                  <PayoutAccountCard account={account} />
                </CardBody>
              </Card>
            </>
          ) : (
            <Card>
              <CardBody>
                <CardTitle>sparx.market earnings</CardTitle>
                <p className="text-base-content/70 max-w-prose text-sm">
                  Join sparx.market — the first-party marketplace — to earn an additional sales
                  channel. sparx handles checkout as merchant-of-record and pays you weekly, minus
                  commission. Your settlement history and payout bank account will appear here once
                  you join.
                </p>
                <div>
                  <Button color="module" render={<Link href="/commerce/market" />}>
                    Join sparx.market
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </ModuleProvider>
  );
}
