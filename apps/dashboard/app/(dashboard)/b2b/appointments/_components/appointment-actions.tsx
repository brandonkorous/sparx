'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';
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
      <Stack direction="row" gap={2}>
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
      </Stack>

      <Modal
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              {action === 'confirm' && 'Confirm appointment'}
              {action === 'complete' && 'Mark as completed'}
              {action === 'cancel' && 'Cancel appointment'}
            </ModalTitle>
            <ModalDescription>
              {action === 'confirm' &&
                `Confirm the ${appointment.serviceTypeName ?? 'service'} appointment. A confirmation email will be sent to the customer.`}
              {action === 'complete' &&
                `Mark the ${appointment.serviceTypeName ?? 'service'} appointment as completed.`}
              {action === 'cancel' &&
                'Cancel this appointment. A cancellation email will be sent to the customer.'}
            </ModalDescription>
          </ModalHeader>

          {action === 'cancel' && (
            <Stack gap={2} className="px-6 pb-2">
              <Text size="sm" className="font-medium">
                Reason (optional)
              </Text>
              <Textarea
                placeholder="Add a reason for the customer…"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </Stack>
          )}

          {error && (
            <Stack className="px-6 pb-2">
              <Text size="sm" variant="danger">
                {error}
              </Text>
            </Stack>
          )}

          <ModalFooter>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
