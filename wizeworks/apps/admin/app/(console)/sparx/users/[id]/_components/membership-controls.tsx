'use client';

// Operator controls for ONE of a user's memberships (gated `user:act`): change the
// role (immediate save), suspend / reactivate the membership, and remove it. Each
// records against the affected tenant's activity log. The last active owner of a
// tenant is protected server-side — those attempts surface as a soft error toast.

import * as React from 'react';
import { Button, Stack, toast, useConfirm } from '@wizeworks/ui';
import { Field, FieldControl, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import type { OperatorUserMembership } from '@wizeworks/operator';
import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/users';
import {
  removeMembershipAction,
  setMembershipRoleAction,
  setMembershipStatusAction,
} from '../actions';

export function MembershipControls({
  userId,
  userLabel,
  membership,
}: {
  userId: string;
  userLabel: string;
  membership: OperatorUserMembership;
}) {
  const confirm = useConfirm();
  const [role, setRole] = React.useState(membership.role);
  const [pending, startTransition] = React.useTransition();
  const suspended = membership.status === 'suspended';
  const tenantLabel = membership.tenantName ?? membership.tenantSlug ?? 'this tenant';

  React.useEffect(() => setRole(membership.role), [membership.role]);

  function saveRole() {
    if (role === membership.role) return;
    startTransition(async () => {
      const res = await setMembershipRoleAction(userId, membership.tenantId, role);
      if (res.ok) toast.success(`${userLabel} set to ${roleLabel(role)} in ${tenantLabel}`);
      else toast.error(res.error);
    });
  }

  function toggleStatus() {
    startTransition(async () => {
      const ok = await confirm({
        title: suspended
          ? `Reactivate access to ${tenantLabel}?`
          : `Suspend access to ${tenantLabel}?`,
        description: suspended
          ? `Restores ${userLabel}’s access to ${tenantLabel}. It appears in that tenant’s account activity as a WizeWorks-initiated change.`
          : `Blocks ${userLabel} from ${tenantLabel} while keeping their account. Recorded in that tenant’s account activity. Reactivate from this page.`,
        confirmLabel: suspended ? 'Reactivate' : 'Suspend',
        color: suspended ? 'module' : 'danger',
      });
      if (!ok) return;
      const res = await setMembershipStatusAction(userId, membership.tenantId, !suspended);
      if (res.ok)
        toast.success(
          suspended ? `Access to ${tenantLabel} restored` : `Access to ${tenantLabel} suspended`
        );
      else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const ok = await confirm({
        title: `Remove ${userLabel} from ${tenantLabel}?`,
        description: `Ends this membership entirely — ${userLabel} loses all access to ${tenantLabel}. Their account and any other memberships stay. This can’t be undone from here (they’d need a fresh invite).`,
        confirmLabel: 'Remove membership',
        color: 'danger',
      });
      if (!ok) return;
      const res = await removeMembershipAction(userId, membership.tenantId);
      if (res.ok) toast.success(`Removed ${userLabel} from ${tenantLabel}`);
      else toast.error(res.error);
    });
  }

  return (
    <Stack direction="row" gap={2} align="end" className="flex-wrap">
      <Field>
        <FieldLabel>Role</FieldLabel>
        <FieldControl
          name={`role-${membership.tenantId}`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          render={
            <NativeSelect>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </NativeSelect>
          }
        />
      </Field>
      <Button
        type="button"
        size="sm"
        color="primary"
        onClick={saveRole}
        disabled={pending || role === membership.role}
      >
        Save role
      </Button>
      <Button
        type="button"
        size="sm"
        color={suspended ? 'primary' : 'warning'}
        variant="soft"
        onClick={toggleStatus}
        disabled={pending}
      >
        {suspended ? 'Reactivate' : 'Suspend'}
      </Button>
      <Button
        type="button"
        size="sm"
        color="danger"
        variant="soft"
        onClick={remove}
        disabled={pending}
      >
        Remove
      </Button>
    </Stack>
  );
}
