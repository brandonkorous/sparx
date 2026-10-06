'use client';

// WHO A HELD ORDER IS WAITING ON (sparx persona issue 087): your team or the
// customer's own approvers ask opposite things of the reader. Read from the
// approval queue by order number; says only what is certain if it cannot answer.

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
