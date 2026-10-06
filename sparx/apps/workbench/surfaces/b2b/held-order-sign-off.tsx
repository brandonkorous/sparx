'use client';

// WHO A HELD ORDER IS WAITING ON, on the order's own pane (sparx persona issue
// 087).
//
// The order pane said "Waiting for approval" and nothing else. Since a spending
// limit can be signed off by the account's own approvers, "approval" could mean
// your team or Teodora at Wasatch, and the two ask opposite things of whoever is
// reading: one is a button to press under Approvals, the other is a wait.
//
// The order endpoint does not carry the sign-off; the approval queue does, and
// can be searched by order number, so this reads that rather than asking for a
// new endpoint. If the queue cannot answer (it failed, or the order is not in
// it) the pane says only what is certain.
//
// Wears the B2B hue on a commerce pane: it is wholesale's functionality
// surfacing here, and color follows functionality.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatDay, useHeldOrderSignOff } from './approvals-data';
import { heldOrderNotice } from './sign-off-words';

export function HeldOrderSignOff({
  ctx,
  orderNumber,
  status,
}: {
  ctx: SurfaceContext;
  orderNumber: string;
  status: string;
}) {
  const held = status === 'pending_approval';
  const { query, item } = useHeldOrderSignOff(orderNumber, held);
  if (!held) return null;
  // Said once the queue has answered, so the notice does not change its mind
  // a second after the pane opens.
  if (query.isPending) return null;

  const notice = heldOrderNotice(item?.signOff ?? null, item?.companyName ?? null, formatDay);
  return (
    <ModuleScope module="b2b">
      <Alert color={notice.tone} variant="soft">
        <AlertContent>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.detail}</AlertDescription>
        </AlertContent>
        <AlertActions>
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('b2b.approvals', {}, { target: 'beside' });
            }}
          >
            Open Approvals
          </Button>
        </AlertActions>
      </Alert>
    </ModuleScope>
  );
}
