'use client';

import { Card, CardBody, CardTitle, EmptyState, Table } from '@wizeworks/silicaui-react';
import { Mail } from 'lucide-react';
import type { OrgInvitation, OrgMember } from '@sparx/auth';
import { InviteForm } from './invite-form';
import { MemberRow } from './member-row';
import { InvitationRow } from './invitation-row';

export interface TeamManagerProps {
  members: OrgMember[];
  invitations: OrgInvitation[];
  canManage: boolean;
  currentUserId: string;
}

// Settings → Team surface: the invite row (owners/admins only), the member
// roster, and the pending-invitation list. Each row owns its own mutations
// (member-row / invitation-row); this component is just the layout + gating.
export function TeamManager({ members, invitations, canManage, currentUserId }: TeamManagerProps) {
  return (
    <div className="flex flex-col gap-6">
      {canManage ? <InviteForm /> : null}

      <Card>
        <CardBody>
          <CardTitle>Members</CardTitle>
          <p className="opacity-70">
            {members.length} {members.length === 1 ? 'person' : 'people'} in this workspace.
          </p>
          <Table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Type</th>
                <th>Role</th>
                {canManage ? <th className="w-10 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canManage={canManage}
                  isSelf={m.userId === currentUserId}
                />
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>Pending invitations</CardTitle>
          <p className="opacity-70">People who&apos;ve been invited but haven&apos;t joined yet.</p>
          {invitations.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="No pending invitations"
              description={
                canManage
                  ? 'Invite a teammate above to get started.'
                  : 'There are no outstanding invitations.'
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited by</th>
                  <th>Expires</th>
                  {canManage ? <th className="w-10 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <InvitationRow key={inv.id} invitation={inv} canManage={canManage} />
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
