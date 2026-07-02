'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  statusTone,
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
import { Trash2 } from 'lucide-react';
import type { OrgInvitation } from '@sparx/auth';
import { revokeInvitation } from '../actions';
import { roleLabel } from '../_lib/roles';

// One outstanding invitation in the Settings → Team list. Owners/admins can
// revoke it, which immediately invalidates its accept link.
export function InvitationRow({
  invitation,
  canManage,
}: {
  invitation: OrgInvitation;
  canManage: boolean;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onRevoke() {
    startTransition(async () => {
      const ok = await confirm({
        title: `Revoke the invitation to ${invitation.email}?`,
        description: `The invite link will stop working immediately.`,
        confirmLabel: 'Revoke invitation',
        tone: 'danger',
      });
      if (!ok) return;
      const result = await revokeInvitation(invitation.id);
      if (result.ok) toast.success('Invitation revoked');
      else toast.error(result.error ?? 'Could not revoke the invitation.');
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Text weight="medium" className="truncate">
          {invitation.email}
        </Text>
      </TableCell>
      <TableCell>
        <Badge color="neutral" variant="soft" size="sm">
          {roleLabel(invitation.role)}
        </Badge>
      </TableCell>
      <TableCell>
        <Text size="sm" variant="muted">
          {invitation.inviterName}
        </Text>
      </TableCell>
      <TableCell>
        <Badge color={statusTone('pending')} variant="soft" size="sm">
          {invitation.expiresAt.toLocaleDateString()}
        </Badge>
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  color="danger"
                  shape="square"
                  size="sm"
                  onClick={onRevoke}
                  disabled={pending}
                  aria-label={`Revoke invitation to ${invitation.email}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revoke invitation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
