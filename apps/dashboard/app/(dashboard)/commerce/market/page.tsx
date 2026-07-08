// Commerce → sparx.market (docs/106 §4.7) — where a seller manages their first-party-
// marketplace presence: the enable/disable toggle, the public merchant profile, and the
// products they've listed. sparx.market is a first-party sales CHANNEL, part of the
// Commerce module (no separate fee), so management lives here in Commerce and the page
// is tinted with the Commerce hue (color-follows-functionality); every /v1/market read
// is gated on Commerce server-side. The MONEY — settlement earnings, payout history, and
// the ACH payout account — lives in Finance → Payouts (docs/109 §5); this page links there.

import Link from 'next/link';
import { Store } from 'lucide-react';
import { Button, Card, CardBody, CardTitle } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getMarketListedProducts, getMarketProfile } from './actions';
import { ListedProductsTable } from './_components/listed-products-table';
import { ParticipationToggle } from './_components/participation-toggle';
import { ProfileForm } from './_components/profile-form';

export const dynamic = 'force-dynamic';

export default async function MarketPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

  const profile = await getMarketProfile();

  // Only fetch the seller-only data once participation is on — a disabled seller has
  // no listings yet, so the page stays a focused "join sparx.market" pitch until they
  // enable it. Earnings + payout account are fetched in Finance → Payouts, not here.
  const listed = profile.enabled ? await getMarketListedProducts() : { rows: [], total: 0 };

  return (
    <ModuleProvider module="commerce">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="sparx.market"
            description="Sell your products on sparx.market, the first-party marketplace — one network where shoppers discover independent sellers across every category. List products from your catalog; sparx handles checkout as merchant-of-record and pays you weekly, minus commission."
          />

          <Card className="bg-module bg-soft">
            <CardBody>
              <CardTitle>Participation</CardTitle>
              <div className="flex flex-col gap-3">
                <ParticipationToggle profile={profile} />
                {!profile.enabled && (
                  <p className="text-base-content/70 max-w-prose text-sm">
                    When you join, your eligible products can be listed on sparx.market and your
                    seller profile appears in the marketplace directory. You keep selling on your
                    own site too — sparx.market is an additional channel, not a replacement.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {profile.enabled && (
            <>
              <Card>
                <CardBody>
                  <CardTitle>Earnings & payouts</CardTitle>
                  <div className="flex flex-col gap-3">
                    <p className="text-base-content/70 max-w-prose text-sm">
                      Your marketplace settlement earnings, weekly payout history, and the bank
                      account sparx pays you to all live in Finance — alongside the rest of your
                      money.
                    </p>
                    <div>
                      <Button
                        variant="soft"
                        color="module"
                        render={<Link href="/finance/payouts" />}
                      >
                        Go to Payouts
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <CardTitle>Seller profile</CardTitle>
                  <ProfileForm profile={profile} />
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <CardTitle>Listed products</CardTitle>
                  <ListedProductsTable products={listed.rows} total={listed.total} />
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </ModuleProvider>
  );
}
