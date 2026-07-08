'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Card, CardBody, CardTitle } from 'silicaui-react';
import { toast } from '@sparx/ui';
import { ArrowRight, Building2, Check, Mail } from 'lucide-react';
import type { OrgMembership, PendingInvitation } from '@sparx/auth';
import { switchOrganization, acceptInvitation } from '@/lib/org-actions';
import { roleLabel, memberTypeLabel } from '../../settings/team/_lib/roles';

export interface AccountsListProps {
  memberships: OrgMembership[];
  invitations: PendingInvitation[];
  activeOrgId: string;
}

export function AccountsList({ memberships, invitations, activeOrgId }: AccountsListProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {memberships.map((m) => (
          <AccountRow
            key={m.organizationId}
            membership={m}
            isActive={m.organizationId === activeOrgId}
          />
        ))}
      </div>

      {invitations.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium">Invitations</p>
          {invitations.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccountRow({ membership, isActive }: { membership: OrgMembership; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onEnter() {
    if (isActive) {
      router.push('/');
      return;
    }
    startTransition(async () => {
      const result = await switchOrganization(membership.organizationId);
      if (result.ok) {
        router.push('/');
      } else {
        toast.error(result.error ?? 'Could not switch workspace.');
      }
    });
  }

  return (
    <Card>
      <CardBody className="pt-6">
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-row items-center gap-3">
            <Avatar size="lg" shape="rounded" aria-hidden>
              <Building2 className="h-5 w-5" />
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-row items-center gap-2">
                <p className="truncate font-medium">{membership.name}</p>
                {isActive ? (
                  <Badge color="success" variant="soft" size="sm">
                    <Check className="h-3 w-3" />
                    Current
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-row items-center gap-2">
                <Badge color="neutral" variant="soft" size="sm">
                  {roleLabel(membership.role)}
                </Badge>
                <p className="text-base-content/70 text-sm">
                  {memberTypeLabel(membership.memberType)}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant={isActive ? 'outline' : 'solid'}
            onClick={onEnter}
            loading={pending}
            disabled={pending}
          >
            {isActive ? 'Open' : 'Enter'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(invitation.id);
      if (result.ok) {
        toast.success(`You've joined ${invitation.orgName}`);
        router.push('/');
      } else {
        toast.error(result.error ?? 'Could not accept the invitation.');
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center gap-2">
          <span aria-hidden className="text-[var(--color-text-secondary)]">
            <Mail className="h-4 w-4" />
          </span>
          <CardTitle>{invitation.orgName}</CardTitle>
          <Badge color="neutral" variant="soft" size="sm">
            {roleLabel(invitation.role)}
          </Badge>
        </div>
        <p className="opacity-70">
          {invitation.inviterName} invited you to join as a{' '}
          {roleLabel(invitation.role).toLowerCase()}.
        </p>
        <Button onClick={onAccept} loading={pending} disabled={pending}>
          Accept invitation
        </Button>
      </CardBody>
    </Card>
  );
}
