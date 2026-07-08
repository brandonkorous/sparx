import { PageHeader } from '@sparx/ui';
import { requireSession, listMyMemberships, listPendingInvitations } from '@sparx/auth';
import { AccountsList } from './_components/accounts-list';

// Client-accounts landing (docs/114 §A.4). A user who belongs to more than one
// organization — a consultant/partner managing client accounts, or someone
// invited onto another team — lands here to choose which workspace to enter.
// Single-membership users can still reach it (the workspace menu links here); it
// just shows their one workspace plus any invitations.
export default async function AccountsPage() {
  const { user } = await requireSession();

  const [memberships, invitations] = await Promise.all([
    listMyMemberships(user.id),
    listPendingInvitations(user.email),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title="Your accounts"
          description="Switch between the workspaces you have access to, or accept an invitation to join another team."
        />
        <AccountsList
          memberships={memberships}
          invitations={invitations}
          activeOrgId={user.tenantId}
        />
      </div>
    </div>
  );
}
