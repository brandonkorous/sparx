'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Stack,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@sparx/ui';
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
    <Stack gap={6}>
      {canManage ? <InviteForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'person' : 'people'} in this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                {canManage ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canManage={canManage}
                  isSelf={m.userId === currentUserId}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            People who&apos;ve been invited but haven&apos;t joined yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead>Expires</TableHead>
                  {canManage ? <TableHead className="w-10 text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <InvitationRow key={inv.id} invitation={inv} canManage={canManage} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
