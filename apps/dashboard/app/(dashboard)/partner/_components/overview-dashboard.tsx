import * as React from 'react';
import {
  Award,
  Coins,
  GraduationCap,
  Handshake,
  Share2,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Badge,
  Container,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Stat,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

import {
  CardLink,
  OverviewCard,
  OverviewRow,
  fmtMoneyCents,
  fmtNumber,
} from '../../_components/overview-bits';
import type { PartnerOverview } from '../_lib/types';
import { TIERS, nextTier } from '../_lib/tiers';

// The partner KPI dashboard (docs/114 §B.7) — the Finance-style money-at-a-glance
// for an active partner. A headline KPI strip (lifetime + pending earnings, active
// + total referrals), the one violet-tinted "Your tier" hero (the single tinted
// card per hue), and a row of neutral quick-link cards into every section. A
// pending / suspended partner sees a status callout so the state is never a guess.

export function PartnerOverviewDashboard({ overview }: { overview: PartnerOverview }) {
  const { partner } = overview;
  const tier = TIERS[partner.tier];
  const upcoming = nextTier(partner.tier);

  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={8} className="py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Partner Portal"
            badge={
              <Badge color={statusTone(partner.status)} variant="soft">
                {statusLabel(partner.status)}
              </Badge>
            }
            description={`${partner.displayName} — your referral link, earnings, bootcamps, and public directory listing.`}
          />

          {partner.status !== 'active' && (
            <OverviewCard title="Application in review" icon={<Award className="h-4 w-4" />}>
              <Text size="sm" variant="muted">
                {partner.status === 'pending'
                  ? 'Your partner profile is live and you can start referring right away. We’re reviewing your application for the higher tier — you’ll earn at the informal rate until it’s approved.'
                  : 'This partner account is suspended. Reach out to the Sparx team to reinstate it.'}
              </Text>
            </OverviewCard>
          )}

          <PartnerKpis overview={overview} />

          {/* The single violet-tinted card — the tier hero. */}
          <OverviewCard
            title="Your tier"
            icon={<Award className="h-4 w-4" />}
            description={tier.tagline}
            right={<CardLink href="/partner/tier">Tier progress</CardLink>}
          >
            <Stack gap={3}>
              <Stack direction="row" align="center" gap={3} wrap>
                <span className="text-[1.65rem] leading-none font-medium">{tier.label}</span>
                <Badge color="module" variant="soft">
                  {tier.commission}
                </Badge>
              </Stack>
              <Text size="sm" variant="muted">
                {upcoming
                  ? `Next up: ${TIERS[upcoming].label} — ${TIERS[upcoming].commission}. ${TIERS[upcoming].howToReach}`
                  : 'You’re at the top tier. You earn ongoing commission and can publish bootcamps publicly.'}
              </Text>
            </Stack>
          </OverviewCard>

          <Stack gap={4}>
            <Heading level={2}>Your program</Heading>
            <Grid cols={1} mdCols={2} lgCols={2} gap={4}>
              <OverviewCard
                title="Referrals"
                icon={<Share2 className="h-4 w-4" />}
                right={<CardLink href="/partner/referrals">Open</CardLink>}
                plain
              >
                <OverviewRow
                  icon={<Users className="h-4 w-4" />}
                  tone="module"
                  title="Accounts referred"
                  hint={`${fmtNumber(overview.activeReferrals)} active`}
                  right={fmtNumber(overview.referralCount)}
                />
                <Text size="sm" variant="muted" className="pt-3">
                  Share your link — code <span className="font-mono">{partner.referralCode}</span>.
                </Text>
              </OverviewCard>

              <OverviewCard
                title="Commissions"
                icon={<Coins className="h-4 w-4" />}
                right={<CardLink href="/partner/commissions">Open</CardLink>}
                plain
              >
                <OverviewRow
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone="success"
                  title="Paid to date"
                  right={fmtMoneyCents(overview.lifetimeCents)}
                />
                <OverviewRow
                  icon={<Coins className="h-4 w-4" />}
                  tone="warning"
                  title="Pending & approved"
                  right={fmtMoneyCents(overview.pendingCents)}
                />
              </OverviewCard>

              <OverviewCard
                title="Bootcamps"
                icon={<GraduationCap className="h-4 w-4" />}
                right={<CardLink href="/partner/bootcamps">Open</CardLink>}
                plain
              >
                <Text size="sm" variant="muted">
                  Host training cohorts on Sparx. Every on-platform RSVP becomes a lead in your CRM.
                  {partner.tier === 'certified'
                    ? ' As a Certified partner you can publish them publicly.'
                    : ' Certified partners can publish theirs to the public directory.'}
                </Text>
              </OverviewCard>

              <OverviewCard
                title="Directory profile"
                icon={<UserRound className="h-4 w-4" />}
                right={<CardLink href="/partner/profile">Edit</CardLink>}
                plain
              >
                <Stack direction="row" align="center" gap={2}>
                  <Badge
                    color={partner.directoryVisible ? statusTone('active') : 'neutral'}
                    variant="soft"
                  >
                    {partner.directoryVisible ? 'Listed' : 'Hidden'}
                  </Badge>
                  <Text size="sm" variant="muted">
                    {partner.directoryVisible
                      ? 'Visible in the public partner directory.'
                      : 'Not shown in the public directory.'}
                  </Text>
                </Stack>
              </OverviewCard>
            </Grid>
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

function PartnerKpis({ overview }: { overview: PartnerOverview }) {
  return (
    <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
      <Stat
        icon={<TrendingUp className="h-4 w-4" />}
        label="Lifetime earned"
        value={fmtMoneyCents(overview.lifetimeCents)}
        hint="Commissions paid out"
      />
      <Stat
        icon={<Coins className="h-4 w-4" />}
        label="Pending"
        value={fmtMoneyCents(overview.pendingCents)}
        hint="Accrued, not yet paid"
      />
      <Stat
        icon={<Users className="h-4 w-4" />}
        label="Active referrals"
        value={fmtNumber(overview.activeReferrals)}
        hint="Paying accounts you referred"
      />
      <Stat
        icon={<Share2 className="h-4 w-4" />}
        label="Total referrals"
        value={fmtNumber(overview.referralCount)}
        hint="Signups under your link"
      />
    </Grid>
  );
}
