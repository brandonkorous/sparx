// sparx.market settings (docs/106 §4.7) — where a seller manages their first-party-
// marketplace participation: the enable/disable toggle, the public merchant profile,
// and the products they've listed. The MONEY — settlement earnings, payout history,
// and the ACH payout bank account — lives in Finance → Payouts (docs/109 §5); this
// page links there. sparx.market is part of the Commerce module (no separate fee), so
// the page is tinted with the Commerce hue per color-follows-functionality, and every
// /v1/market read is gated on Commerce server-side.

import Link from 'next/link';
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

import { getMarketListedProducts, getMarketProfile } from './actions';
import { ListedProductsTable } from './_components/listed-products-table';
import { ParticipationToggle } from './_components/participation-toggle';
import { ProfileForm } from './_components/profile-form';

export const dynamic = 'force-dynamic';

export default async function MarketSettingsPage() {
  const profile = await getMarketProfile();

  // Only fetch the seller-only data once participation is on — a disabled seller has
  // no listings yet, so the page stays a focused "join sparx.market" pitch until they
  // enable it. Earnings + payout account are fetched in Finance → Payouts, not here.
  const listed = profile.enabled ? await getMarketListedProducts() : { rows: [], total: 0 };

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
              <Card variant="module">
                <CardHeader>
                  <CardTitle>Earnings & payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Stack gap={3}>
                    <Text size="sm" variant="muted" className="max-w-prose">
                      Your marketplace settlement earnings, weekly payout history, and the bank
                      account sparx pays you to all live in Finance — alongside the rest of your
                      money.
                    </Text>
                    <Link
                      href="/finance/payouts"
                      className="text-sm font-medium text-[var(--module-active-text)] hover:underline"
                    >
                      Go to Finance → Payouts →
                    </Link>
                  </Stack>
                </CardContent>
              </Card>

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
