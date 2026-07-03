import { ArrowUpRight, Handshake } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  EmptyState,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';
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
    <Container size="lg">
      <Stack gap={8} className="py-10">
        <PageHeader
          icon={<Handshake className="h-5 w-5" />}
          title="Your Sparx partner"
          description="The Sparx partner that referred this account, and anyone from a partner who can manage this workspace for you."
        />

        {!canManage ? (
          <Card padding="none">
            <EmptyState
              icon={<Handshake className="h-5 w-5" />}
              title="Managed by owners and admins"
              description="Partner access to this workspace is managed by its owners and admins. Ask one of them if you need a change."
            />
          </Card>
        ) : (
          <>
            <Stack gap={3}>
              <Text weight="medium">Referred by</Text>
              {relationship.referredBy ? (
                <ReferredByCard partner={relationship.referredBy} />
              ) : (
                <Card padding="none">
                  <EmptyState
                    icon={<Handshake className="h-5 w-5" />}
                    title="No referring partner"
                    description="This account didn’t sign up through a Sparx partner. If a partner set you up, they’ll be shown here."
                  />
                </Card>
              )}
            </Stack>

            <Stack gap={3}>
              <Text weight="medium">Who can manage this workspace</Text>
              <Text size="sm" variant="muted">
                External partners get access as consultants on your team. Revoke a seat any time —
                your data always stays yours.
              </Text>
              <PartnerAccessList consultants={consultants} canManage={canManage} />
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}

function ReferredByCard({ partner }: { partner: ReferredByPartner }) {
  const referred = fmtDate(partner.referredAt);
  return (
    <ModuleProvider module="partner">
      <Card variant="module" padding="md">
        <CardContent className="p-0">
          <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
            <Stack direction="row" align="center" gap={3} className="min-w-0">
              <Avatar size="lg" shape="square" aria-hidden>
                <Handshake className="h-5 w-5" />
              </Avatar>
              <Stack gap={1} className="min-w-0">
                <Text weight="medium" className="truncate">
                  {partner.displayName}
                </Text>
                <Stack direction="row" align="center" gap={2} className="flex-wrap">
                  <Badge color="module" variant="soft" size="sm">
                    {tierLabel(partner.tier)}
                  </Badge>
                  {referred ? (
                    <Text size="xs" variant="muted">
                      Referred you {referred}
                    </Text>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>
            {partner.directoryListed ? (
              <Button asChild variant="soft" color="module" size="sm">
                <a
                  href={`${MARKETING_ORIGIN}/partners/${partner.partnerId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View profile
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </ModuleProvider>
  );
}
