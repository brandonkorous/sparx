'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  Button,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';
import { api } from '@/lib/api-rest-client';

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
      await api.post(`/v1/b2b/approval-queue/${orderId}/${action}`, {
        reason: reason.trim() || undefined,
      });
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
        <Button
          size="sm"
          color="success"
          variant="soft"
          disabled={isPending}
          onClick={() => setAction('approve')}
        >
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="soft"
          disabled={isPending}
          onClick={() => setAction('reject')}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Reject
        </Button>
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
              {action === 'approve' ? 'Approve' : 'Reject'} Order #{orderNumber}
            </ModalTitle>
          </ModalHeader>

          <Stack gap={4} className="px-6 py-2">
            <Text size="sm" variant="muted">
              {action === 'approve'
                ? 'The order will be placed and the buyer notified.'
                : 'The order will be cancelled and the buyer notified.'}
            </Text>
            <Stack gap={2}>
              <Text size="sm" className="font-medium">
                Reason (optional)
              </Text>
              <Textarea
                placeholder="Add a note for the buyer…"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </Stack>
            {error && (
              <Text size="sm" className="text-[var(--color-danger)]">
                {error}
              </Text>
            )}
          </Stack>

          <ModalFooter>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
