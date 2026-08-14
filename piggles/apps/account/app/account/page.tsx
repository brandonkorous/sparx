import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { requireSession } from '@sparx/auth';
import { prisma } from '@sparx/db';
import { Logo } from '@piggles/brand/react';
import { PRODUCT } from '@piggles/config';

export const metadata: Metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

// The account home: what you pay, what state it is in, and the way back to work.
//
// ── WHAT IS NOT HERE YET, AND WHY IT IS ABSENT RATHER THAN FAKED ────────────
//
// Capacity. Piggles' whole commercial model is "charge for scale, not for
// access": storage, email volume, contacts and seats. There is no meter for any
// of them — no usage model in the schema, nothing counting. So this page shows
// no capacity, rather than showing four bars sitting at zero.
//
// Four bars at zero would be a LIE of exactly the kind this platform has a rule
// against: a value nobody measured must never render as one. "0 of 10 GB used"
// reads as a measurement and would be a default, and the person reading it would
// reasonably conclude they had used nothing.
//
// The metering has to start before the billing does — usage tiers set later need
// history to be priced, and history cannot be backfilled. That makes meters the
// next piece of work, not a later one.

function trialState(trialEndsAt: Date | null, status: string) {
  if (status !== 'trialing' || !trialEndsAt) return null;
  const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000);
  return { days, over: days <= 0 };
}

export default async function AccountPage() {
  const session = await requireSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      name: true,
      slug: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      platformBrand: true,
    },
  });

  const trial = trialState(tenant?.trialEndsAt ?? null, tenant?.subscriptionStatus ?? '');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Logo />
        <Link className={buttonClasses({ color: 'primary' })} href="/handoff">
          Go to my business
        </Link>
      </div>

      <h1 className="mt-12 text-3xl font-extrabold sm:text-4xl">
        {tenant?.name ?? 'Your account'}
      </h1>
      <p className="mt-2 text-lg">
        Signed in as {session.user.email}. This is where you deal with {PRODUCT.name} — your
        business itself lives at {PRODUCT.hosts.console}.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="text-xl font-bold">Your plan</h2>
            <p className="mt-1 text-base">All fifteen apps, one price.</p>
            <p className="mt-4 text-4xl font-extrabold">
              $49<span className="text-base font-bold">/month</span>
            </p>
            <div className="mt-4">
              {/* Status is its own colour axis — a lifecycle state gets a
                  semantic tone, never a neutral pill. */}
              {trial ? (
                <Badge color={trial.over ? 'warning' : 'success'} variant="soft" size="lg">
                  {trial.over
                    ? 'Trial finished'
                    : `Free trial — ${trial.days} day${trial.days === 1 ? '' : 's'} left`}
                </Badge>
              ) : (
                <Badge
                  color={tenant?.subscriptionStatus === 'active' ? 'success' : 'warning'}
                  variant="soft"
                  size="lg"
                >
                  {tenant?.subscriptionStatus ?? 'unknown'}
                </Badge>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-xl font-bold">Your business address</h2>
            <p className="mt-1 text-base">
              Every Piggles business gets one from the start. Point your own domain at it whenever
              you are ready.
            </p>
            <p className="mt-4 text-lg font-bold break-all">
              {tenant?.slug}.{PRODUCT.tenantSites.suffix}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="border-base-300 mt-12 border-t pt-8">
        <h2 className="text-xl font-bold">Payment and capacity</h2>
        <p className="mt-2 text-base">
          There is nothing to pay while you are on the trial, and no card on file. Adding a payment
          method, seeing invoices, and adding room for more people, storage or email all live here —
          they are the next thing being built.
        </p>
      </div>
    </main>
  );
}
