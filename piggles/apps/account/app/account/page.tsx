import type { Metadata } from 'next';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { requireSession } from '@wizeworks/auth-client-server';
import { PRODUCT } from '@piggles/config';
import { AccountBar } from '@/components/account/account-bar';
import { BillingNotice } from '@/components/account/billing-notice';
import { CookieSection } from '@/components/account/cookie-section';
import { PaymentSection } from '@/components/account/payment-section';
import { PlanCard } from '@/components/account/plan-card';
import { Capacity } from '@/components/capacity';
import { loadAccountHome } from '@/lib/account-load';
import { canPay } from '@/lib/pay-roles';
import { planState } from '@/lib/plan-state';

export const metadata: Metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

// The account home: what you pay, what you are using, and the way back to work.
// The badge and the Payment sentence both come from `planState`, so they agree.

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const session = await requireSession();
  const [{ billing: marker }, home] = await Promise.all([searchParams, loadAccountHome()]);
  const { business, billing, consent, capacity } = home;
  const plan = planState(
    business?.subscriptionStatus,
    business?.trialEndsAt,
    !!billing?.subscribed
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <AccountBar />
      <BillingNotice marker={marker} />

      <h1 className="mt-12 text-3xl font-extrabold sm:text-4xl">
        {business?.name ?? 'Your account'}
      </h1>
      <p className="mt-2 text-lg">
        Signed in as {session.user.email}. This is where you deal with {PRODUCT.name}. Your business
        itself lives at {PRODUCT.hosts.console}.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <PlanCard plan={plan} billing={billing} />
        <Card>
          <CardBody>
            <h2 className="text-xl font-bold">Your business address</h2>
            <p className="mt-1 text-base">
              Every Piggles business gets one from the start. Point your own domain at it whenever
              you are ready.
            </p>
            <p className="mt-4 text-lg font-bold break-all">
              {business?.siteHost ?? `${business?.slug}.${PRODUCT.tenantSites.suffix}`}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-10">
        <Capacity report={capacity} />
      </div>

      <PaymentSection plan={plan} billing={billing} mayPay={canPay(session.user.role)} />
      <CookieSection consent={consent} />
    </main>
  );
}
