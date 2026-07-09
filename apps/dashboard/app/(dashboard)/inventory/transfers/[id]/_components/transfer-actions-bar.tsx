'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@wizeworks/silicaui-react';

import {
  cancelTransferAction,
  deleteTransferAction,
  shipTransferAction,
} from '../../../_lib/transfer-actions';
import type { ActionResult } from '../../../_lib/rest-action';

type Armed = 'cancel' | 'delete' | null;

// Lifecycle actions for a transfer (docs/100 P4). Ship advances a draft into
// transit (source → in-transit). Receiving is done from the lines panel (it takes
// per-line received quantities). Cancel returns an in-transit transfer's goods to
// source (or voids a draft) and Delete removes a draft — both forgo/undo work, so
// they arm-then-confirm per the destructive-actions rule.

export function TransferActionsBar({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [armed, setArmed] = React.useState<Armed>(null);
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<ActionResult<unknown>>, navigateAfter?: string): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error.message);
        setArmed(null);
        return;
      }
      setArmed(null);
      if (navigateAfter) router.push(navigateAfter);
      router.refresh();
    });
  }

  const canShip = status === 'draft';
  const canCancel = status === 'draft' || status === 'in_transit';
  const canDelete = status === 'draft';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-center gap-2">
        {canShip && (
          <Button
            color="module"
            size="sm"
            disabled={busy}
            onClick={() => run(() => shipTransferAction(id))}
          >
            {busy ? 'Shipping…' : 'Ship transfer'}
          </Button>
        )}

        {canCancel &&
          (armed === 'cancel' ? (
            <Confirm
              label={status === 'in_transit' ? 'Return to source' : 'Confirm cancel'}
              busy={busy}
              color="danger"
              onConfirm={() => run(() => cancelTransferAction(id))}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setArmed('cancel')}>
              {status === 'in_transit' ? 'Cancel & return' : 'Cancel transfer'}
            </Button>
          ))}

        {canDelete &&
          (armed === 'delete' ? (
            <Confirm
              label="Confirm delete"
              busy={busy}
              color="danger"
              onConfirm={() => run(() => deleteTransferAction(id), '/inventory/transfers')}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setArmed('delete')}>
              Delete draft
            </Button>
          ))}
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}

function Confirm({
  label,
  busy,
  color,
  onConfirm,
  onCancel,
}: {
  label: string;
  busy: boolean;
  color: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-row items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Keep
      </Button>
      <Button color={color} size="sm" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : label}
      </Button>
    </div>
  );
}
