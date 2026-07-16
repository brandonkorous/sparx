import { ArrowUpRight, Handshake } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';
import { listOrgMembers, requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { PartnerAccessList } from './_components/partner-access-list';

// Settings → Partner access (docs/114 §B.7). The CLIENT side of the partner
// relationship — the mirror of the Partner Portal. It answers "do I have a Sparx
// partner, and who can get into my account?":
//   • Referred by — the partner whose link this account signed up under (from the
//     system-resolved /v1/tenant/partner; invisible to the client under normal RLS).
//   • Who can manage this workspace — the consultant seats (partner people) with
//     live access, each revocable. Owners/admins manage it; others see it read-only.

export const dynamic = 'force-dynamic';

// The public partner directory lives on the marketing site (docs/114 §B.6). Same
// origin the OG images + canonical URLs use.
const MARKETING_ORIGIN = 'https://sparx.works';

interface ReferredByPartner {
  partnerId: string;
  displayName: string;
  tier: string;
  referredAt: string;
  referralStatus: string;
  directoryListed: boolean;
}

interface PartnerRelationship {
  referredBy: ReferredByPartner | null;
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function SettingsPartnerPage() {
  const { user } = await requireSession();
  const canManage = user.role === 'owner' || user.role === 'admin';

  // referredBy is admin-gated at the API; the consultant roster is auth-layer.
  // Typing the promise contextually types both branches to PartnerRelationship,
  // so the empty-relationship literals need no assertion.
  const relationshipPromise: Promise<PartnerRelationship> = canManage
    ? api.get<PartnerRelationship>('/v1/tenant/partner').catch(() => ({ referredBy: null }))
    : Promise.resolve({ referredBy: null });
  const [relationship, members] = await Promise.all([
    relationshipPromise,
    listOrgMembers(user.tenantId),
  ]);

  const consultants = members
    .filter((m) => m.memberType === 'consultant' && m.status === 'active')
    .map((m) => ({ id: m.id, name: m.name ?? '', email: m.email, role: m.role }));

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-10">
        <PageHeader
          icon={<Handshake className="h-5 w-5" />}
          title="Your Sparx partner"
          description="The Sparx partner that referred this account, and anyone from a partner who can manage this workspace for you."
        />

        {!canManage ? (
          <Card>
            <EmptyState
              icon={<Handshake className="h-5 w-5" />}
              title="Managed by owners and admins"
              description="Partner access to this workspace is managed by its owners and admins. Ask one of them if you need a change."
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <p className="font-medium">Referred by</p>
              {relationship.referredBy ? (
                <ReferredByCard partner={relationship.referredBy} />
              ) : (
                <Card>
                  <EmptyState
                    icon={<Handshake className="h-5 w-5" />}
                    title="No referring partner"
                    description="This account didn’t sign up through a Sparx partner. If a partner set you up, they’ll be shown here."
                  />
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-medium">Who can manage this workspace</p>
              <p className="text-base-content text-sm">
                External partners get access as consultants on your team. Revoke a seat any time —
                your data always stays yours.
              </p>
              <PartnerAccessList consultants={consultants} canManage={canManage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReferredByCard({ partner }: { partner: ReferredByPartner }) {
  const referred = fmtDate(partner.referredAt);
  return (
    <ModuleProvider module="partner">
      <Card className="bg-module bg-soft">
        <CardBody className="p-0">
          <div className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-row items-center gap-3">
              <Avatar size="lg" shape="rounded" aria-hidden>
                <Handshake className="h-5 w-5" />
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate font-medium">{partner.displayName}</p>
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <Badge color="module" variant="soft" size="sm">
                    {tierLabel(partner.tier)}
                  </Badge>
                  {referred ? (
                    <p className="text-base-content text-xs">Referred you {referred}</p>
                  ) : null}
                </div>
              </div>
            </div>
            {partner.directoryListed ? (
              <Button
                variant="soft"
                color="module"
                size="sm"
                render={
                  <a
                    href={`${MARKETING_ORIGIN}/partners/${partner.partnerId}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View profile"
                  />
                }
                iconEnd={<ArrowUpRight className="h-3.5 w-3.5" />}
              >
                View profile
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}
