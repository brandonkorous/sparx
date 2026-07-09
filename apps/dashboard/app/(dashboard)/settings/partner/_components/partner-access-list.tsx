'use client';

import * as React from 'react';
import { Avatar, Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
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
      <Card>
        <EmptyState
          icon={<UserX className="h-5 w-5" />}
          title="No partner has access"
          description="No external partner currently has consultant access to this workspace. If a Sparx partner manages your account, the person they use will appear here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {consultants.map((c) => (
        <ConsultantCard key={c.id} consultant={c} canManage={canManage} />
      ))}
    </div>
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
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-row items-center gap-3">
            <Avatar alt={displayName} size="md" />
            <div className="flex min-w-0 flex-col gap-0">
              <p className="truncate font-medium">{displayName}</p>
              <p className="text-base-content/70 truncate text-sm">{consultant.email}</p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3">
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
                iconStart={<UserX className="h-4 w-4" />}
              >
                Revoke
              </Button>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
