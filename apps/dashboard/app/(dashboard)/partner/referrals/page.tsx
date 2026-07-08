import { Share2 } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { PartnerLocked } from '../_components/partner-locked';
import { PartnerAccessLocked } from '../_components/partner-access-locked';
import { getPartnerAccess } from '../_lib/access';
import type { PartnerProfile, ReferralsResponse } from '../_lib/types';
import { ReferralLinkCard } from './_components/referral-link';
import { ReferralsList } from './_components/referrals-list';

// Partner Portal — Referrals (docs/114 §B.7). The referral link (copy) + the
// ledger of accounts that signed up under it. Gated on the partner row; a
// non-partner deep-linking here gets the join prompt instead of a forbidden error.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PartnerReferralsPage({ searchParams }: PageProps) {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (!profile) return <PartnerLocked section="Referrals" />;
  const { canOperate } = await getPartnerAccess();
  if (!canOperate) return <PartnerAccessLocked section="Referrals" />;

  const params = await searchParams;
  const [prefs, data] = await Promise.all([
    getUserPreferences(),
    api.get<ReferralsResponse>('/v1/partner/referrals'),
  ]);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';
  const referrals = data.referrals ?? [];

  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Share2 className="h-5 w-5" />}
            title="Referrals"
            badge={
              <Badge color="module">
                {referrals.length} referral{referrals.length === 1 ? '' : 's'}
              </Badge>
            }
            description="Share your link and track every account that signs up under it. You earn commission when a referral makes their first payment."
          />

          <ReferralLinkCard referralCode={data.referralCode} />

          {referrals.length === 0 ? (
            <Card>
              <CardBody className="p-0">
                <EmptyState
                  icon={<Share2 className="h-5 w-5" />}
                  title="No referrals yet"
                  description="Share your referral link above. New signups that come through it will appear here, along with their status and your commission rate."
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <ListToolbar enableViewToggle searchable={false} />
              <ReferralsList rows={referrals} view={view} />
            </>
          )}
        </div>
      </div>
    </ModuleProvider>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
