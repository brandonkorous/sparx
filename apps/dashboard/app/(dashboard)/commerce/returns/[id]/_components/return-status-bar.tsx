'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';

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
    <Stack gap={1} align="end">
      <Stack direction="row" gap={2}>
        {canMarkReceived && (
          <Button variant="outline" disabled={pending} onClick={onMarkReceived}>
            <Package className="h-4 w-4" />
            Mark received
          </Button>
        )}
        {canDeny && (
          <Button variant="ghost" disabled={pending} onClick={() => setDenyOpen(true)}>
            Deny
          </Button>
        )}
      </Stack>
      {error && (
        <Text size="xs" variant="danger" role="alert" aria-live="polite">
          {error}
        </Text>
      )}

      <Modal
        open={denyOpen}
        onOpenChange={(open) => {
          if (!open) onDenyCancel();
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Deny return?</ModalTitle>
          </ModalHeader>
          <Stack gap={3} className="px-6 pb-2">
            <Text size="sm" variant="muted">
              The customer is notified the return was rejected. They may re-open if circumstances
              change.
            </Text>
            <Stack gap={1}>
              <Text size="sm" as="label">
                Reason for denial (shown to customer)
              </Text>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the return is being denied…"
                rows={3}
              />
            </Stack>
          </Stack>
          <ModalFooter>
            <Button variant="ghost" disabled={pending} onClick={onDenyCancel}>
              Cancel
            </Button>
            <Button color="danger" disabled={pending || !reason.trim()} onClick={onDenySubmit}>
              {pending ? 'Denying…' : 'Deny return'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}
