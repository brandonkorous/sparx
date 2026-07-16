'use client';

import * as React from 'react';
import { Avatar, Badge, Button, Select, Tooltip } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { UserX } from 'lucide-react';
import { ASSIGNABLE_ORG_ROLES, type AssignableOrgRole } from '@sparx/auth/org-roles';
import type { OrgMember } from '@sparx/auth';
import { changeMemberRole, removeMember } from '../actions';
import { ROLE_LABELS, roleLabel, memberTypeLabel } from '../_lib/roles';

const ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_ORG_ROLES.map((r) => [r, ROLE_LABELS[r]])
);

// One member in the Settings → Team roster. Owners/admins can change a member's
// role inline or remove them; owners and the current user are protected (you
// can't demote/remove yourself or the owner — that prevents locking out the
// last administrator).
export function MemberRow({
  member,
  canManage,
  isSelf,
}: {
  member: OrgMember;
  canManage: boolean;
  isSelf: boolean;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const trimmedName = member.name?.trim();
  const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : member.email;
  const isOwner = member.role === 'owner';
  const editable = canManage && !isOwner && !isSelf;

  function onRoleChange(next: string) {
    startTransition(async () => {
      const result = await changeMemberRole(member.id, next as AssignableOrgRole);
      if (result.ok) toast.success(`${displayName} is now ${roleLabel(next)}`);
      else toast.error(result.error ?? 'Could not change the role.');
    });
  }

  function onRemove() {
    startTransition(async () => {
      const ok = await confirm({
        title: `Remove ${displayName}?`,
        description: `They'll immediately lose access to this workspace. This can't be undone, but you can invite them again.`,
        confirmLabel: 'Remove member',
        tone: 'danger',
      });
      if (!ok) return;
      const result = await removeMember(member.id);
      if (result.ok) toast.success(`${displayName} removed`);
      else toast.error(result.error ?? 'Could not remove the member.');
    });
  }

  return (
    <tr>
      <td>
        <div className="flex min-w-0 flex-row items-center gap-3">
          <Avatar alt={displayName} size="md" />
          <div className="flex min-w-0 flex-col gap-0">
            <p className="truncate font-medium">
              {displayName}
              {isSelf ? <span className="text-base-content"> (you)</span> : null}
            </p>
            <p className="text-base-content truncate text-sm">{member.email}</p>
          </div>
        </div>
      </td>
      <td>
        <Badge color="neutral" variant="soft" size="sm">
          {memberTypeLabel(member.memberType)}
        </Badge>
      </td>
      <td>
        {editable ? (
          <Select
            value={member.role}
            onValueChange={(v) => onRoleChange(v as string)}
            disabled={pending}
            items={ROLE_ITEMS}
            className="w-36"
            aria-label={`Role for ${displayName}`}
          />
        ) : (
          <Badge color={isOwner ? 'primary' : 'neutral'} variant="soft" size="sm">
            {roleLabel(member.role)}
          </Badge>
        )}
      </td>
      {canManage ? (
        <td className="text-right">
          {editable ? (
            <Tooltip content="Remove member">
              <Button
                variant="ghost"
                color="danger"
                shape="square"
                size="sm"
                onClick={onRemove}
                disabled={pending}
                aria-label={`Remove ${displayName}`}
              >
                <UserX className="h-4 w-4" />
              </Button>
            </Tooltip>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
