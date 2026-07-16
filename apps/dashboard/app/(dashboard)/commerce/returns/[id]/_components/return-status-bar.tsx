'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';

import { toast } from '@sparx/ui';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';

import { denyReturnAction, markReturnReceivedAction } from '../../../return-actions';

// Lifecycle controls for a return, teleported into the detail frame's header
// (drawer/modal chrome or the full-page shell) via the shared header slot —
// parity with TemplateStatusBar. Errors surface as a toast: the header bar has
// no room for inline error text.
export function ReturnStatusBar({ returnId, status }: { returnId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [denyOpen, setDenyOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  function onMarkReceived() {
    startTransition(async () => {
      const result = await markReturnReceivedAction(returnId);
      if (!result.ok) {
        toast.error(result.error.message);
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
        toast.error(result.error.message);
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
    <div className="flex flex-row items-center gap-2">
      {canDeny && (
        <Tooltip content="Deny">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Deny"
            disabled={pending}
            onClick={() => setDenyOpen(true)}
          >
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {canMarkReceived && (
        <Button
          variant="solid"
          color="module"
          size="sm"
          disabled={pending}
          onClick={onMarkReceived}
        >
          Mark received
        </Button>
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
            <p className="text-base-content text-sm">
              The customer is notified the return was rejected. They may re-open if circumstances
              change.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="deny-return-reason">
                Reason for denial (shown to customer)
              </label>
              <Textarea
                id="deny-return-reason"
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
