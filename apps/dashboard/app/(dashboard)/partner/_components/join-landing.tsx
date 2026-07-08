import * as React from 'react';
import { Check, Handshake } from 'lucide-react';
import { Card, CardBody } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { TIER_ORDER, TIERS } from '../_lib/tiers';
import { EarningsCalculator } from './earnings-calculator';
import { JoinForm } from './join-form';

// The "Become a Sparx Partner" landing (docs/114 §B.2/§B.7) — what a non-partner
// tenant sees at /partner: a value-prop hero (the one violet-tinted card, per the
// one-tint-per-hue rule), a live earnings calculator, the four-step how-it-works,
// the three-tier ladder, then the APPLICATION form (owner/admin only — `canApply`).
// Every tier is an application for staff review — there is no instant signup. The
// chrome + button carry the program's violet; the body cards stay neutral.

const HERO_STATS = [
  { value: '20–30%', label: 'commission on each referral’s first payment' },
  { value: '5% ongoing', label: 'on the accounts you manage, at the Certified tier' },
  { value: '8 modules', label: 'your clients can turn on — site to AI, one bill' },
];

const STEPS = [
  {
    n: '01',
    t: 'Join',
    d: 'Claim your referral link instantly at the Informal tier, or apply for a higher one.',
  },
  {
    n: '02',
    t: 'Refer',
    d: 'Bring clients onto Sparx with your link. Signups are attributed to you automatically.',
  },
  {
    n: '03',
    t: 'Earn',
    d: 'When a referral makes their first payment, you earn commission — paid out monthly.',
  },
  {
    n: '04',
    t: 'Grow',
    d: 'Get listed in the directory, host bootcamps, and move up a tier for higher rates.',
  },
];

export function PartnerJoinLanding({ canApply }: { canApply: boolean }) {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Become a Sparx Partner"
            description="Build your practice on Sparx: refer clients, earn on every account you bring in, get listed in the public directory, and host bootcamps. No reseller contract, no minimums."
          />

          <Hero />
          <EarningsCalculator />
          <HowItWorks />
          <TierLadder />

          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Apply to the program</h2>
            {canApply ? (
              <JoinForm />
            ) : (
              <Card>
                <CardBody>
                  <p className="text-base-content/70 text-sm">
                    Applying to the Partner Program is an owner or admin action. Ask an owner or
                    admin of this workspace to apply — every application is reviewed before
                    approval.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}

// The one violet-tinted card on this surface — the value proposition + headline
// economics, so the payoff leads.
function Hero() {
  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="text-[2rem] leading-none font-medium text-[var(--module-active-text)]">
                  {s.value}
                </span>
                <p className="text-base-content/70 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function HowItWorks() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <CardBody>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-sm text-[var(--module-active)]">{s.n}</span>
                <p className="text-base font-medium">{s.t}</p>
                <p className="text-base-content/70 text-sm">{s.d}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TierLadder() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Choose where to start</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIER_ORDER.map((t) => {
          const meta = TIERS[t];
          return (
            <Card key={t}>
              <CardBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-medium">{meta.label}</p>
                    <p className="text-sm text-[var(--module-active-text)]">{meta.commission}</p>
                    <p className="text-base-content/70 text-sm">{meta.tagline}</p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {meta.unlocks.map((u) => (
                      <li key={u} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                        <p className="text-sm">{u}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
