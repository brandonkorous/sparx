import { Container, PageHeader, Stack } from '@sparx/ui';
import { requireSession, listOrgMembers, listOrgInvitations } from '@sparx/auth';
import { TeamManager } from './_components/team-manager';

// Settings → Team (docs/114 §A.4). Lists the members of the caller's ACTIVE
// organization (staff + consultants, distinguished by member_type) plus any
// outstanding invitations. Owners and admins get the invite / role / remove
// controls; everyone else sees a read-only roster. All mutations run through the
// Better Auth org plugin (see actions.ts).
export default async function TeamSettingsPage() {
  const { user } = await requireSession();
  const canManage = user.role === 'owner' || user.role === 'admin';

  const [members, invitations] = await Promise.all([
    listOrgMembers(user.tenantId),
    listOrgInvitations(user.tenantId),
  ]);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Team"
          description="Invite people to your workspace, assign roles, and manage access."
        />
        <TeamManager
          members={members}
          invitations={invitations}
          canManage={canManage}
          currentUserId={user.id}
        />
      </Stack>
    </Container>
  );
}
