'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { performAppointmentAction } from '../_lib/actions';

interface AppointmentRow {
  id: string;
  serviceTypeName: string | null;
  status: string;
}

interface Props {
  appointment: AppointmentRow;
}

type Action = 'confirm' | 'complete' | 'cancel' | null;

export function AppointmentActions({ appointment }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { status } = appointment;
  const canConfirm = status === 'requested';
  const canComplete = status === 'confirmed' || status === 'in_progress';
  const canCancel = status === 'requested' || status === 'confirmed' || status === 'in_progress';

  if (!canConfirm && !canComplete && !canCancel) return null;

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
      const { error: err } = await performAppointmentAction(appointment.id, action, reason);
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
        {canConfirm && (
          <Button
            size="sm"
            color="success"
            variant="soft"
            disabled={isPending}
            onClick={() => setAction('confirm')}
          >
            Confirm
          </Button>
        )}
        {canComplete && (
          <Button
            size="sm"
            color="primary"
            variant="soft"
            disabled={isPending}
            onClick={() => setAction('complete')}
          >
            Complete
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            color="danger"
            variant="ghost"
            disabled={isPending}
            onClick={() => setAction('cancel')}
          >
            Cancel
          </Button>
        )}
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
              {action === 'confirm' && 'Confirm appointment'}
              {action === 'complete' && 'Mark as completed'}
              {action === 'cancel' && 'Cancel appointment'}
            </DialogTitle>
            <DialogDescription>
              {action === 'confirm' &&
                `Confirm the ${appointment.serviceTypeName ?? 'service'} appointment. A confirmation email will be sent to the customer.`}
              {action === 'complete' &&
                `Mark the ${appointment.serviceTypeName ?? 'service'} appointment as completed.`}
              {action === 'cancel' &&
                'Cancel this appointment. A cancellation email will be sent to the customer.'}
            </DialogDescription>
          </div>

          {action === 'cancel' && (
            <div className="flex flex-col gap-2 px-6 pb-2">
              <Field>
                <FieldLabel>Reason (optional)</FieldLabel>
                <FieldControl
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                  render={<Textarea placeholder="Add a reason for the customer…" rows={3} />}
                />
              </Field>
            </div>
          )}

          {error && (
            <div className="flex flex-col gap-4 px-6 pb-2">
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" disabled={submitting} onClick={close}>
              Back
            </Button>
            <Button
              color={action === 'cancel' ? 'danger' : action === 'confirm' ? 'success' : 'primary'}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting
                ? 'Saving…'
                : action === 'confirm'
                  ? 'Confirm appointment'
                  : action === 'complete'
                    ? 'Mark completed'
                    : 'Cancel appointment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
