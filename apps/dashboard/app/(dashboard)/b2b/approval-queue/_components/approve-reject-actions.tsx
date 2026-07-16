'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { approveOrder, rejectOrder } from '../_lib/actions';

interface Props {
  orderId: string;
  orderNumber: string;
}

export function ApproveRejectActions({ orderId, orderNumber }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setAction(null);
    setReason('');
    setError(null);
  }

  async function handleSubmit() {
    if (!action) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } =
        action === 'approve'
          ? await approveOrder(orderId, reason)
          : await rejectOrder(orderId, reason);
      if (err) throw new Error(err);
      setAction(null);
      setReason('');
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-row gap-2">
        <Button
          size="sm"
          color="success"
          variant="soft"
          disabled={isPending}
          iconStart={<CheckCircle className="h-3.5 w-3.5" />}
          onClick={() => setAction('approve')}
        >
          Approve
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="soft"
          disabled={isPending}
          iconStart={<XCircle className="h-3.5 w-3.5" />}
          onClick={() => setAction('reject')}
        >
          Reject
        </Button>
      </div>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent>
          <div>
            <DialogTitle>
              {action === 'approve' ? 'Approve' : 'Reject'} Order #{orderNumber}
            </DialogTitle>
          </div>

          <div className="flex flex-col gap-4 px-6 py-2">
            <p className="text-base-content text-sm">
              {action === 'approve'
                ? 'The order will be placed and the buyer notified.'
                : 'The order will be cancelled and the buyer notified.'}
            </p>
            <Field>
              <FieldLabel>Reason (optional)</FieldLabel>
              <FieldControl
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                render={<Textarea placeholder="Add a note for the buyer…" rows={3} />}
              />
            </Field>
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" disabled={submitting} onClick={close}>
              Cancel
            </Button>
            <Button
              color={action === 'approve' ? 'success' : 'danger'}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting
                ? `${action === 'approve' ? 'Approving' : 'Rejecting'}…`
                : action === 'approve'
                  ? 'Approve Order'
                  : 'Reject Order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
