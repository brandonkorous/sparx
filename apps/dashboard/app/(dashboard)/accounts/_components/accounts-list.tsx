'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Stack,
  Text,
  toast,
} from '@sparx/ui';
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
    <Stack gap={6}>
      <Stack gap={3}>
        {memberships.map((m) => (
          <AccountRow
            key={m.organizationId}
            membership={m}
            isActive={m.organizationId === activeOrgId}
          />
        ))}
      </Stack>

      {invitations.length > 0 ? (
        <Stack gap={3}>
          <Text weight="medium">Invitations</Text>
          {invitations.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv} />
          ))}
        </Stack>
      ) : null}
    </Stack>
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
      <CardContent className="pt-6">
        <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
          <Stack direction="row" align="center" gap={3} className="min-w-0">
            <Avatar size="lg" shape="square" aria-hidden>
              <Building2 className="h-5 w-5" />
            </Avatar>
            <Stack gap={1} className="min-w-0">
              <Stack direction="row" align="center" gap={2} className="min-w-0">
                <Text weight="medium" className="truncate">
                  {membership.name}
                </Text>
                {isActive ? (
                  <Badge color="success" variant="soft" size="sm">
                    <Check className="h-3 w-3" />
                    Current
                  </Badge>
                ) : null}
              </Stack>
              <Stack direction="row" align="center" gap={2}>
                <Badge color="neutral" variant="soft" size="sm">
                  {roleLabel(membership.role)}
                </Badge>
                <Text size="sm" variant="muted">
                  {memberTypeLabel(membership.memberType)}
                </Text>
              </Stack>
            </Stack>
          </Stack>
          <Button
            variant={isActive ? 'outline' : 'solid'}
            onClick={onEnter}
            loading={pending}
            disabled={pending}
          >
            {isActive ? 'Open' : 'Enter'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Stack>
      </CardContent>
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
      <CardHeader>
        <Stack direction="row" align="center" gap={2}>
          <span aria-hidden className="text-[var(--color-text-secondary)]">
            <Mail className="h-4 w-4" />
          </span>
          <CardTitle>{invitation.orgName}</CardTitle>
          <Badge color="neutral" variant="soft" size="sm">
            {roleLabel(invitation.role)}
          </Badge>
        </Stack>
        <CardDescription>
          {invitation.inviterName} invited you to join as a{' '}
          {roleLabel(invitation.role).toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onAccept} loading={pending} disabled={pending}>
          Accept invitation
        </Button>
      </CardContent>
    </Card>
  );
}
