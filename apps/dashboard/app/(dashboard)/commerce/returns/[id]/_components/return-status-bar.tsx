'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';

import { Button, Dialog, DialogContent, DialogTitle, Textarea } from 'silicaui-react';

import { denyReturnAction, markReturnReceivedAction } from '../../../return-actions';

export function ReturnStatusBar({ returnId, status }: { returnId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [denyOpen, setDenyOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  function onMarkReceived() {
    startTransition(async () => {
      const result = await markReturnReceivedAction(returnId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onDenySubmit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setDenyOpen(false);
    setReason('');
    startTransition(async () => {
      const result = await denyReturnAction({ returnId, reason: trimmed });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onDenyCancel() {
    setDenyOpen(false);
    setReason('');
  }

  const canDeny = status === 'requested';
  const canMarkReceived =
    status === 'approved' || status === 'awaiting_shipment' || status === 'in_transit';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-row gap-2">
        {canMarkReceived && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={onMarkReceived}
            iconStart={<Package className="h-4 w-4" />}
          >
            Mark received
          </Button>
        )}
        {canDeny && (
          <Button variant="ghost" disabled={pending} onClick={() => setDenyOpen(true)}>
            Deny
          </Button>
        )}
      </div>
      {error && (
        <p className="text-danger text-xs" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <Dialog
        open={denyOpen}
        onOpenChange={(open) => {
          if (!open) onDenyCancel();
        }}
      >
        <DialogContent>
          <div>
            <DialogTitle>Deny return?</DialogTitle>
          </div>
          <div className="flex flex-col gap-3 px-6 pb-2">
            <p className="text-base-content/70 text-sm">
              The customer is notified the return was rejected. They may re-open if circumstances
              change.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Reason for denial (shown to customer)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the return is being denied…"
                rows={3}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={onDenyCancel}>
              Cancel
            </Button>
            <Button color="danger" disabled={pending || !reason.trim()} onClick={onDenySubmit}>
              {pending ? 'Denying…' : 'Deny return'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
