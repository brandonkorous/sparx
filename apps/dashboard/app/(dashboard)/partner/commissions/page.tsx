import { Banknote, Coins, Wallet } from 'lucide-react';
import { Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader, Stat } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { OverviewCard, fmtMoneyCents } from '../../_components/overview-bits';
import { PartnerLocked } from '../_components/partner-locked';
import { PartnerAccessLocked } from '../_components/partner-access-locked';
import { getPartnerAccess } from '../_lib/access';
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
  const { canOperate } = await getPartnerAccess();
  if (!canOperate) return <PartnerAccessLocked section="Commissions" />;

  const [commissions, payouts] = await Promise.all([
    api.get<PartnerCommission[]>('/v1/partner/commissions').catch(() => [] as PartnerCommission[]),
    api.get<PartnerPayoutRun[]>('/v1/partner/payouts').catch(() => [] as PartnerPayoutRun[]),
  ]);

  const paidCents = sumBy(commissions, ['paid']);
  const pendingCents = sumBy(commissions, ['pending', 'approved']);

  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Coins className="h-5 w-5" />}
            title="Commissions"
            description="What you’ve earned, what’s still accruing, and your monthly payout history."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          </div>

          {/* The single tinted accent card — the payout account. */}
          <OverviewCard title="Payouts" icon={<Banknote className="h-4 w-4" />}>
            <PayoutSetup connected={profile.stripePayoutAccountId != null} />
          </OverviewCard>

          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Commission ledger</h2>
            {commissions.length === 0 ? (
              <Card>
                <CardBody className="p-0">
                  <EmptyState
                    icon={<Coins className="h-5 w-5" />}
                    title="No commissions yet"
                    description="When a referred account makes its first payment, your commission accrues here at your snapshot rate."
                  />
                </CardBody>
              </Card>
            ) : (
              <CommissionsList rows={commissions} view="table" />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Payout history</h2>
            {payouts.length === 0 ? (
              <Card>
                <CardBody className="p-0">
                  <EmptyState
                    icon={<Banknote className="h-5 w-5" />}
                    title="No payouts yet"
                    description="Approved commissions are grouped into a monthly payout once they clear your threshold. Each run shows up here."
                  />
                </CardBody>
              </Card>
            ) : (
              <PayoutsList rows={payouts} view="table" />
            )}
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}
