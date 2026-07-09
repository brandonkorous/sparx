'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@wizeworks/silicaui-react';

import {
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  deletePurchaseOrderAction,
  submitPurchaseOrderAction,
} from '../../../_lib/purchase-order-actions';
import type { ActionResult } from '../../../_lib/rest-action';

type Armed = 'cancel' | 'close' | 'delete' | null;

// Lifecycle + print actions for a PO (docs/100 P3b). Submit advances a draft;
// cancel/close/delete are destructive, so they arm-then-confirm (name the effect)
// per the destructive-actions rule. Print opens the branded document in a new tab
// (server route proxies the authed api-rest render).

export function PurchaseOrderActionsBar({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [armed, setArmed] = React.useState<Armed>(null);
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<ActionResult<unknown>>, onDone?: () => void): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error.message);
        setArmed(null);
        return;
      }
      setArmed(null);
      if (onDone) onDone();
      else router.refresh();
    });
  }

  const canSubmit = status === 'draft';
  const canReceive = status === 'submitted' || status === 'partial';
  const canCancel = status === 'draft' || status === 'submitted';
  const canClose = status === 'submitted' || status === 'partial' || status === 'received';
  const canDelete = status === 'draft';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={
            <a
              href={`/inventory/purchase-orders/${id}/document`}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Print / PDF
        </Button>

        {canReceive && (
          <Button
            color="module"
            size="sm"
            render={<Link href={`/inventory/purchase-orders/${id}/receive`} />}
          >
            Receive
          </Button>
        )}

        {canSubmit && (
          <Button
            color="module"
            size="sm"
            disabled={busy}
            onClick={() => run(() => submitPurchaseOrderAction(id))}
          >
            {busy ? 'Submitting…' : 'Submit order'}
          </Button>
        )}

        {canClose &&
          (armed === 'close' ? (
            <Confirm
              label="Confirm close"
              busy={busy}
              color="warning"
              onConfirm={() => run(() => closePurchaseOrderAction(id))}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setArmed('close')}>
              Close
            </Button>
          ))}

        {canCancel &&
          (armed === 'cancel' ? (
            <Confirm
              label="Confirm cancel"
              busy={busy}
              color="danger"
              onConfirm={() => run(() => cancelPurchaseOrderAction(id))}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setArmed('cancel')}>
              Cancel order
            </Button>
          ))}

        {canDelete &&
          (armed === 'delete' ? (
            <Confirm
              label="Confirm delete"
              busy={busy}
              color="danger"
              onConfirm={() =>
                run(
                  () => deletePurchaseOrderAction(id),
                  () => router.push('/inventory/purchase-orders')
                )
              }
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
