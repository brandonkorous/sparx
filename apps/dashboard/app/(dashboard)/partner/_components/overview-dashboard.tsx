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
import { Badge } from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader, Stat, statusLabel, statusTone } from '@sparx/ui';

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
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
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
              <p className="text-base-content/70 text-sm">
                {partner.status === 'pending'
                  ? 'Your partner profile is live and you can start referring right away. We’re reviewing your application for the higher tier — you’ll earn at the informal rate until it’s approved.'
                  : 'This partner account is suspended. Reach out to the Sparx team to reinstate it.'}
              </p>
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
            <div className="flex flex-col gap-3">
              <div className="flex flex-row flex-wrap items-center gap-3">
                <span className="text-[1.65rem] leading-none font-medium">{tier.label}</span>
                <Badge color="module" variant="soft">
                  {tier.commission}
                </Badge>
              </div>
              <p className="text-base-content/70 text-sm">
                {upcoming
                  ? `Next up: ${TIERS[upcoming].label} — ${TIERS[upcoming].commission}. ${TIERS[upcoming].howToReach}`
                  : 'You’re at the top tier. You earn ongoing commission and can publish bootcamps publicly.'}
              </p>
            </div>
          </OverviewCard>

          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Your program</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
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
                <p className="text-base-content/70 pt-3 text-sm">
                  Share your link — code <span className="font-mono">{partner.referralCode}</span>.
                </p>
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
                <p className="text-base-content/70 text-sm">
                  Host training cohorts on Sparx. Every on-platform RSVP becomes a lead in your CRM.
                  {partner.tier === 'certified'
                    ? ' As a Certified partner you can publish them publicly.'
                    : ' Certified partners can publish theirs to the public directory.'}
                </p>
              </OverviewCard>

              <OverviewCard
                title="Directory profile"
                icon={<UserRound className="h-4 w-4" />}
                right={<CardLink href="/partner/profile">Edit</CardLink>}
                plain
              >
                <div className="flex flex-row items-center gap-2">
                  <Badge
                    color={partner.directoryVisible ? statusTone('active') : 'neutral'}
                    variant="soft"
                  >
                    {partner.directoryVisible ? 'Listed' : 'Hidden'}
                  </Badge>
                  <p className="text-base-content/70 text-sm">
                    {partner.directoryVisible
                      ? 'Visible in the public partner directory.'
                      : 'Not shown in the public directory.'}
                  </p>
                </div>
              </OverviewCard>
            </div>
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}

function PartnerKpis({ overview }: { overview: PartnerOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}
