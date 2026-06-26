// sparx.market settings (docs/106 §4.7) — the canonical surface where a seller
// manages their first-party-marketplace participation: the enable/disable toggle,
// settlement earnings + payout history, the public merchant profile, the ACH
// payout bank account, and the products they've listed. The weekly settlement
// email links here. sparx.market is part of the Commerce module (no separate fee),
// so the page is tinted with the Commerce hue per color-follows-functionality, and
// every /v1/market read is gated on Commerce server-side.

import { Store } from 'lucide-react';
import {
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

import {
  getMarketListedProducts,
  getMarketPayoutAccount,
  getMarketProfile,
  getMarketSettlementRuns,
  getMarketSettlementSummary,
} from './actions';
import { ListedProductsTable } from './_components/listed-products-table';
import { ParticipationToggle } from './_components/participation-toggle';
import { PayoutAccountForm } from './_components/payout-account-form';
import { ProfileForm } from './_components/profile-form';
import { SettlementPanel } from './_components/settlement-panel';

export const dynamic = 'force-dynamic';

export default async function MarketSettingsPage() {
  const profile = await getMarketProfile();

  // Only fetch the seller-only data once participation is on — a disabled seller
  // has no settlement, no listings, and no need for a payout account yet, so the
  // page stays a focused "join sparx.market" pitch until they enable it.
  const [account, listed, summary, runs] = profile.enabled
    ? await Promise.all([
        getMarketPayoutAccount(),
        getMarketListedProducts(),
        getMarketSettlementSummary(),
        getMarketSettlementRuns(),
      ])
    : [null, { rows: [], total: 0 }, null, []];

  return (
    <ModuleProvider module="commerce">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="sparx.market"
            description="Sell your products on sparx.market, the first-party marketplace — one network where shoppers discover independent sellers across every category. List products from your catalog; sparx handles checkout as merchant-of-record and pays you weekly, minus commission."
          />

          <Card variant="module">
            <CardHeader>
              <CardTitle>Participation</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={3}>
                <ParticipationToggle profile={profile} />
                {!profile.enabled && (
                  <Text size="sm" variant="muted" className="max-w-prose">
                    When you join, your eligible products can be listed on sparx.market and your
                    seller profile appears in the marketplace directory. You keep selling on your
                    own site too — sparx.market is an additional channel, not a replacement.
                  </Text>
                )}
              </Stack>
            </CardContent>
          </Card>

          {profile.enabled && (
            <>
              <SettlementPanel summary={summary} runs={runs} />

              <Card variant="module">
                <CardHeader>
                  <CardTitle>Seller profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProfileForm profile={profile} />
                </CardContent>
              </Card>

              <Card variant="module">
                <CardHeader>
                  <CardTitle>Payout account</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayoutAccountForm account={account} />
                </CardContent>
              </Card>

              <Card variant="module">
                <CardHeader>
                  <CardTitle>Listed products</CardTitle>
                </CardHeader>
                <CardContent>
                  <ListedProductsTable products={listed.rows} total={listed.total} />
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
