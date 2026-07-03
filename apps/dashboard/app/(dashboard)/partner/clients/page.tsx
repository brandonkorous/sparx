import { Building2 } from 'lucide-react';
import { Card, Container, EmptyState, ModuleProvider, PageHeader, Stack } from '@sparx/ui';
import { listMyMemberships, requireSession, type OrgMembership } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { PartnerLocked } from '../_components/partner-locked';
import { PartnerAccessLocked } from '../_components/partner-access-locked';
import { getPartnerAccess } from '../_lib/access';
import { shortTenantRef } from '../_lib/format';
import type {
  PartnerClient,
  PartnerProfile,
  PartnerReferral,
  ReferralsResponse,
} from '../_lib/types';
import { PartnerClientsList } from './_components/clients-list';

// Partner Portal — Clients (docs/114 §B.7). A partner's book of business: the
// UNION of two relationships that were previously disconnected —
//   • referral attribution (partner-scoped `partner_referrals`): who signed up
//     under the partner's link, and what it earns; and
//   • consultant access (auth-layer `members` where member_type=consultant): the
//     client orgs this operator can actually enter and manage.
// A client can be one or both. This is where "managed accounts" (the certified 5%
// ongoing perk) becomes concrete: a referral the partner also manages.

export const dynamic = 'force-dynamic';

// Fold the referral ledger + the operator's consultant memberships into one
// keyed-by-org client list. Referrals seed the map (they carry the earning
// relationship); memberships flip `managed` on and add access-only clients.
function buildClientList(
  referrals: PartnerReferral[],
  consultancies: OrgMembership[]
): PartnerClient[] {
  const byId = new Map<string, PartnerClient>();

  for (const r of referrals) {
    byId.set(r.referredTenantId, {
      orgId: r.referredTenantId,
      name: r.referredOrgName ?? shortTenantRef(r.referredTenantId),
      referred: true,
      managed: false,
      referralStatus: r.status,
      firstPaymentAt: r.firstPaymentAt,
      commissionType: r.commissionType,
      slug: null,
    });
  }

  for (const c of consultancies) {
    const existing = byId.get(c.organizationId);
    if (existing) {
      existing.managed = true;
      existing.slug = c.slug;
    } else {
      byId.set(c.organizationId, {
        orgId: c.organizationId,
        name: c.name,
        referred: false,
        managed: true,
        referralStatus: null,
        firstPaymentAt: null,
        commissionType: null,
        slug: c.slug,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default async function PartnerClientsPage() {
  const [{ canOperate }, profile] = await Promise.all([
    getPartnerAccess(),
    api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null),
  ]);
  if (!profile) return <PartnerLocked section="Clients" />;
  if (!canOperate) return <PartnerAccessLocked section="Clients" />;

  const { user } = await requireSession();
  const [refData, memberships] = await Promise.all([
    api
      .get<ReferralsResponse>('/v1/partner/referrals')
      .catch(() => ({ referralCode: '', referrals: [] as PartnerReferral[] })),
    listMyMemberships(user.id),
  ]);

  const consultancies = memberships.filter((m) => m.memberType === 'consultant');
  const clients = buildClientList(refData.referrals, consultancies);

  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Building2 className="h-5 w-5" />}
            title="Clients"
            description="Every account you referred or actively manage. Enter a managed account to work in it directly; ongoing commission on managed accounts is a Certified-tier perk."
          />

          {clients.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                title="No clients yet"
                description="Refer accounts with your link, or ask a client to add you as a consultant in their workspace — accounts you refer or manage will appear here."
              />
            </Card>
          ) : (
            <PartnerClientsList clients={clients} />
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
