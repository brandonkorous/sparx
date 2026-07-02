import { Banknote, Coins, Wallet } from 'lucide-react';
import {
  Card,
  Container,
  EmptyState,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Stat,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { OverviewCard, fmtMoneyCents } from '../../_components/overview-bits';
import { PartnerLocked } from '../_components/partner-locked';
import type { PartnerCommission, PartnerPayoutRun, PartnerProfile } from '../_lib/types';
import { CommissionsList } from './_components/commissions-list';
import { PayoutSetup } from './_components/payout-setup';
import { PayoutsList } from './_components/payouts-list';

// Partner Portal — Commissions (docs/114 §B.7). Earnings summary, the payout
// account CTA (Connect onboarding is a later slice — the button degrades to a calm
// "coming soon"), the commission ledger, and payout-run history. Read-only money
// views, so they render as tables with one tinted "Payouts" accent card.

export const dynamic = 'force-dynamic';

function sumBy(rows: PartnerCommission[], statuses: string[]): number {
  return rows.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c.amountCents, 0);
}

export default async function PartnerCommissionsPage() {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (!profile) return <PartnerLocked section="Commissions" />;

  const [commissions, payouts] = await Promise.all([
    api.get<PartnerCommission[]>('/v1/partner/commissions').catch(() => [] as PartnerCommission[]),
    api.get<PartnerPayoutRun[]>('/v1/partner/payouts').catch(() => [] as PartnerPayoutRun[]),
  ]);

  const paidCents = sumBy(commissions, ['paid']);
  const pendingCents = sumBy(commissions, ['pending', 'approved']);

  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Coins className="h-5 w-5" />}
            title="Commissions"
            description="What you’ve earned, what’s still accruing, and your monthly payout history."
          />

          <Grid cols={1} mdCols={3} gap={4}>
            <Stat
              icon={<Wallet className="h-4 w-4" />}
              label="Paid to date"
              value={fmtMoneyCents(paidCents)}
              hint="Across all payout runs"
            />
            <Stat
              icon={<Coins className="h-4 w-4" />}
              label="Pending & approved"
              value={fmtMoneyCents(pendingCents)}
              hint="Accrued, not yet paid"
            />
            <Stat
              icon={<Banknote className="h-4 w-4" />}
              label="Payout threshold"
              value={fmtMoneyCents(profile.payoutMinCents)}
              hint="Minimum before a payout runs"
            />
          </Grid>

          {/* The single tinted accent card — the payout account. */}
          <OverviewCard title="Payouts" icon={<Banknote className="h-4 w-4" />}>
            <PayoutSetup connected={profile.stripePayoutAccountId != null} />
          </OverviewCard>

          <Stack gap={3}>
            <Heading level={2}>Commission ledger</Heading>
            {commissions.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  icon={<Coins className="h-5 w-5" />}
                  title="No commissions yet"
                  description="When a referred account makes its first payment, your commission accrues here at your snapshot rate."
                />
              </Card>
            ) : (
              <CommissionsList rows={commissions} view="table" />
            )}
          </Stack>

          <Stack gap={3}>
            <Heading level={2}>Payout history</Heading>
            {payouts.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  icon={<Banknote className="h-5 w-5" />}
                  title="No payouts yet"
                  description="Approved commissions are grouped into a monthly payout once they clear your threshold. Each run shows up here."
                />
              </Card>
            ) : (
              <PayoutsList rows={payouts} view="table" />
            )}
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
