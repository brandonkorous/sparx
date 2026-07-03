'use client';

import * as React from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { UserX } from 'lucide-react';

import { roleLabel } from '../../team/_lib/roles';
import { revokePartnerAccess } from '../actions';

// The consultants (external partner people) who currently hold access to THIS
// workspace (docs/114 §B.7). Owners/admins can revoke a seat — a destructive act,
// so it's behind a confirm that names who loses access. A non-manager gets a
// read-only list (no revoke buttons); the page decides whether to pass `canManage`.

export interface ConsultantRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function PartnerAccessList({
  consultants,
  canManage,
}: {
  consultants: ConsultantRow[];
  canManage: boolean;
}) {
  if (consultants.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<UserX className="h-5 w-5" />}
          title="No partner has access"
          description="No external partner currently has consultant access to this workspace. If a Sparx partner manages your account, the person they use will appear here."
        />
      </Card>
    );
  }

  return (
    <Stack gap={3}>
      {consultants.map((c) => (
        <ConsultantCard key={c.id} consultant={c} canManage={canManage} />
      ))}
    </Stack>
  );
}

function ConsultantCard({
  consultant,
  canManage,
}: {
  consultant: ConsultantRow;
  canManage: boolean;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const displayName = consultant.name?.trim() || consultant.email;

  function onRevoke() {
    startTransition(async () => {
      const ok = await confirm({
        title: `Revoke ${displayName}'s access?`,
        description: `They'll immediately lose access to this workspace. Your data stays yours — this only removes their consultant seat. You can invite them back any time.`,
        confirmLabel: 'Revoke access',
        tone: 'danger',
      });
      if (!ok) return;
      const result = await revokePartnerAccess(consultant.id);
      if (result.ok) toast.success(`${displayName}'s access revoked`);
      else toast.error(result.error ?? 'Could not revoke access.');
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
          <Stack direction="row" align="center" gap={3} className="min-w-0">
            <Avatar alt={displayName} size="md" />
            <Stack gap={0} className="min-w-0">
              <Text weight="medium" className="truncate">
                {displayName}
              </Text>
              <Text size="sm" variant="muted" className="truncate">
                {consultant.email}
              </Text>
            </Stack>
          </Stack>
          <Stack direction="row" align="center" gap={3}>
            <Badge color="neutral" variant="soft" size="sm">
              {roleLabel(consultant.role)}
            </Badge>
            {canManage ? (
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={onRevoke}
                loading={pending}
                disabled={pending}
              >
                <UserX className="h-4 w-4" />
                Revoke
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
