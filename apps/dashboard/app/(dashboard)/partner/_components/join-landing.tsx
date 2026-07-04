import * as React from 'react';
import { Check, Handshake } from 'lucide-react';
import { Card, Container, Grid, Heading, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

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
      <Container size="xl">
        <Stack gap={10} className="py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Become a Sparx Partner"
            description="Build your practice on Sparx: refer clients, earn on every account you bring in, get listed in the public directory, and host bootcamps. No reseller contract, no minimums."
          />

          <Hero />
          <EarningsCalculator />
          <HowItWorks />
          <TierLadder />

          <Stack gap={4}>
            <Heading level={2}>Apply to the program</Heading>
            {canApply ? (
              <JoinForm />
            ) : (
              <Card variant="default" padding="lg">
                <Text size="sm" variant="muted">
                  Applying to the Partner Program is an owner or admin action. Ask an owner or admin
                  of this workspace to apply — every application is reviewed before approval.
                </Text>
              </Card>
            )}
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

// The one violet-tinted card on this surface — the value proposition + headline
// economics, so the payoff leads.
function Hero() {
  return (
    <Card variant="module" padding="lg">
      <Stack gap={5}>
        <Grid cols={1} mdCols={3} gap={4}>
          {HERO_STATS.map((s) => (
            <Stack key={s.label} gap={1}>
              <span className="text-[2rem] leading-none font-medium text-[var(--module-active-text)]">
                {s.value}
              </span>
              <Text size="sm" variant="muted">
                {s.label}
              </Text>
            </Stack>
          ))}
        </Grid>
      </Stack>
    </Card>
  );
}

function HowItWorks() {
  return (
    <Stack gap={4}>
      <Heading level={2}>How it works</Heading>
      <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
        {STEPS.map((s) => (
          <Card key={s.n} variant="default" padding="md">
            <Stack gap={2}>
              <span className="font-mono text-sm text-[var(--module-active)]">{s.n}</span>
              <Text weight="medium">{s.t}</Text>
              <Text size="sm" variant="muted">
                {s.d}
              </Text>
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

function TierLadder() {
  return (
    <Stack gap={4}>
      <Heading level={2}>Choose where to start</Heading>
      <Grid cols={1} mdCols={3} gap={4}>
        {TIER_ORDER.map((t) => {
          const meta = TIERS[t];
          return (
            <Card key={t} variant="default" padding="lg">
              <Stack gap={3}>
                <Stack gap={1}>
                  <Text size="lg" weight="medium">
                    {meta.label}
                  </Text>
                  <Text size="sm" className="text-[var(--module-active-text)]">
                    {meta.commission}
                  </Text>
                  <Text size="sm" variant="muted">
                    {meta.tagline}
                  </Text>
                </Stack>
                <ul className="flex flex-col gap-2">
                  {meta.unlocks.map((u) => (
                    <li key={u} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                      <Text size="sm">{u}</Text>
                    </li>
                  ))}
                </ul>
              </Stack>
            </Card>
          );
        })}
      </Grid>
    </Stack>
  );
}
