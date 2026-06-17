'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Stack, Text } from '@sparx/ui';

import {
  approveCountAction,
  cancelCountAction,
  postCountAction,
  submitCountAction,
} from '../../../_lib/count-actions';
import type { ActionResult } from '../../../_lib/rest-action';

type Armed = 'post' | 'cancel' | null;

// Lifecycle actions for a count (docs/100 P4). Submit advances counting → review
// (freezing the variance + the approval requirement). Approve is the admin
// sign-off when the variance value clears the threshold. Post applies the recount
// movements and cancel abandons — both change/forgo stock, so they arm-then-confirm
// per the destructive-actions rule. The API enforces the admin role on approve.

export function CountActionsBar({
  id,
  status,
  requiresApproval,
}: {
  id: string;
  status: string;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [armed, setArmed] = React.useState<Armed>(null);
  const [error, setError] = React.useState<string | null>(null);

  function run(fn: () => Promise<ActionResult<unknown>>): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error.message);
        setArmed(null);
        return;
      }
      setArmed(null);
      router.refresh();
    });
  }

  const canSubmit = status === 'counting';
  const canApprove = status === 'review' && requiresApproval;
  const canPost = (status === 'review' && !requiresApproval) || status === 'approved';
  const canCancel = status !== 'posted' && status !== 'cancelled';

  return (
    <Stack gap={2}>
      <Stack direction="row" gap={2} align="center" wrap>
        {canSubmit && (
          <Button
            color="module"
            size="sm"
            disabled={busy}
            onClick={() => run(() => submitCountAction(id))}
          >
            {busy ? 'Submitting…' : 'Submit for review'}
          </Button>
        )}

        {canApprove && (
          <Button
            color="primary"
            size="sm"
            disabled={busy}
            onClick={() => run(() => approveCountAction(id))}
          >
            {busy ? 'Approving…' : 'Approve'}
          </Button>
        )}

        {canPost &&
          (armed === 'post' ? (
            <Confirm
              label="Confirm post"
              busy={busy}
              color="warning"
              onConfirm={() => run(() => postCountAction(id))}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button color="module" size="sm" disabled={busy} onClick={() => setArmed('post')}>
              Post recounts
            </Button>
          ))}

        {canCancel &&
          (armed === 'cancel' ? (
            <Confirm
              label="Confirm cancel"
              busy={busy}
              color="danger"
              onConfirm={() => run(() => cancelCountAction(id))}
              onCancel={() => setArmed(null)}
            />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setArmed('cancel')}>
              Cancel count
            </Button>
          ))}
      </Stack>
      {error && (
        <Text size="xs" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
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
    <Stack direction="row" gap={1} align="center">
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Keep
      </Button>
      <Button color={color} size="sm" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : label}
      </Button>
    </Stack>
  );
}
