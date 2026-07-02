'use client';

import * as React from 'react';
import {
  Avatar,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  TableCell,
  TableRow,
  Text,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useConfirm,
} from '@sparx/ui';
import { UserX } from 'lucide-react';
import { ASSIGNABLE_ORG_ROLES, type AssignableOrgRole } from '@sparx/auth/org-roles';
import type { OrgMember } from '@sparx/auth';
import { changeMemberRole, removeMember } from '../actions';
import { ROLE_LABELS, roleLabel, memberTypeLabel } from '../_lib/roles';

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
    <TableRow>
      <TableCell>
        <Stack direction="row" align="center" gap={3} className="min-w-0">
          <Avatar alt={displayName} size="md" />
          <Stack gap={0} className="min-w-0">
            <Text weight="medium" className="truncate">
              {displayName}
              {isSelf ? <span className="text-[var(--color-text-secondary)]"> (you)</span> : null}
            </Text>
            <Text size="sm" variant="muted" className="truncate">
              {member.email}
            </Text>
          </Stack>
        </Stack>
      </TableCell>
      <TableCell>
        <Badge color="neutral" variant="soft" size="sm">
          {memberTypeLabel(member.memberType)}
        </Badge>
      </TableCell>
      <TableCell>
        {editable ? (
          <Select value={member.role} onValueChange={onRoleChange} disabled={pending}>
            <SelectTrigger className="w-36" aria-label={`Role for ${displayName}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ORG_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge color={isOwner ? 'primary' : 'neutral'} variant="soft" size="sm">
            {roleLabel(member.role)}
          </Badge>
        )}
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          {editable ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>Remove member</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
