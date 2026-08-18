import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { requireSession } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';
import { Logo } from '@piggles/brand/react';
import { AppearanceControl } from '@/components/appearance-control';
import { PRODUCT } from '@piggles/config';
import { capacityReport } from '@wizeworks/usage';
import { Capacity } from '@/components/capacity';
import { readConsent } from '@/lib/consent';

export const metadata: Metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

// The account home: what you pay, what you are using, and the way back to work.
//
// Capacity is measured, never assumed. A meter with no snapshot reads "not
// measured yet" and a ceiling nobody has decided draws no bar — a value nobody
// took must never render as one.

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

  // The analytics answer, shown as a fact rather than as a control. This page
  // reports where things stand; changing a decision happens on the screen that
  // asked for it, which is the same screen either way.
  //
  // Three states, and all three are rendered differently. "Not asked yet" is not
  // folded into "no" — they mean different things, and a person who has never
  // been asked seeing the word "no" would reasonably conclude they had answered.
  const consent = await readConsent(session.user.id, session.user.tenantId);

  // The brand decides the ceilings; this app is single-brand, but the tenant's
  // own column is still what answers it — a tenant belongs to a brand, not to a
  // deployment.
  const capacity = await capacityReport(session.user.tenantId, tenant?.platformBrand ?? null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Logo />
        {/* A PLAIN ANCHOR, and it must stay one. `/handoff` is not a page — it
            is a redirect endpoint that 303s to another ORIGIN (mypiggles.com).
            Next's client router soft-navigates a <Link>: it fetches the RSC
            payload for the href, the 303 sends that fetch cross-origin, CORS
            refuses it, and the console fills with

              Failed to fetch RSC payload for …/handoff. Falling back to
              browser navigation. TypeError: Failed to fetch

            on every click of the one button this page exists for. The fallback
            is why it limps rather than dying outright, which is what kept it
            unnoticed. An <a> does the real navigation first time, with no failed
            request and no error.

            Same rule for every other entry to the door — see the note in
            accept-invite-client.tsx. */}
        <div className="flex items-center gap-2">
          {/* Beside the way out, not instead of it — the same corner it occupies
              on the signed-out screens, so it does not move once somebody has an
              account. */}
          <AppearanceControl />
          <a className={buttonClasses({ color: 'primary' })} href="/handoff">
            Go to my business
          </a>
        </div>
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
              {/* Status is its own color axis — a lifecycle state gets a
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

      <div className="mt-10">
        <Capacity report={capacity} />
      </div>

      <div className="border-base-300 mt-12 border-t pt-8">
        <h2 className="text-xl font-bold">Payment</h2>
        <p className="mt-2 text-base">
          There is nothing to pay while you are on the trial, and no card on file. Adding a payment
          method, seeing invoices, and buying more room are the next thing being built.
        </p>
      </div>

      <div className="border-base-300 mt-10 border-t pt-8">
        <h2 className="text-xl font-bold">Cookie choices</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {consent === null ? (
            <Badge color="warning" variant="soft" size="lg">
              Not asked yet
            </Badge>
          ) : (
            <Badge color={consent.analytics ? 'success' : 'neutral'} variant="soft" size="lg">
              {consent.analytics ? 'Helping us improve' : 'Analytics off'}
            </Badge>
          )}
          <Link
            className={buttonClasses({ color: 'neutral', variant: 'outline' })}
            href="/cookie-choices"
          >
            {consent === null ? 'Answer it' : 'Change this'}
          </Link>
        </div>
        <p className="mt-3 max-w-prose text-base">
          {consent === null
            ? `Whether ${PRODUCT.name} may see which screens you use. Nothing is being counted until you say so.`
            : consent.analytics
              ? `${PRODUCT.name} counts which screens get used inside your workspace, so we can fix what is confusing. Never sold, never advertising, and never anything you have stored.`
              : `${PRODUCT.name} is counting nothing. The only cookies left are the ones that keep you signed in.`}{' '}
          <a
            className="font-semibold underline"
            href={`https://${PRODUCT.hosts.marketing}/cookies`}
            target="_blank"
            rel="noreferrer"
          >
            Every cookie we set
          </a>
          .
        </p>
      </div>
    </main>
  );
}
