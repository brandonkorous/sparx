'use client';

import * as React from 'react';
import { Button, Label, NativeSelect, Stack, Text, Textarea, toast } from '@sparx/ui';
import type { OperatorFeedbackReplyInput } from '@sparx/operator';
import { FEEDBACK_STATUSES, feedbackStatusLabel } from '@/lib/feedback';
import { replyFeedbackAction } from '../actions';

// Compose a staff reply. Optionally bundle a status change (e.g. reply + mark
// shipped). Sending always emails the submitter (when they have an address) and
// flags the thread unread — the server publishes `feedback.responded`.
export function ReplyComposer({
  tenantId,
  submissionId,
  currentStatus,
  hasEmail,
}: {
  tenantId: string;
  submissionId: string;
  currentStatus: string;
  hasEmail: boolean;
}) {
  const [body, setBody] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function send() {
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error('Write a reply first.');
      return;
    }
    const input: OperatorFeedbackReplyInput = {
      body: trimmed,
      ...(status ? { status: status as OperatorFeedbackReplyInput['status'] } : {}),
    };
    startTransition(async () => {
      const res = await replyFeedbackAction(tenantId, submissionId, input);
      if (res.ok) {
        toast.success(res.message);
        setBody('');
        setStatus('');
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Stack gap={3}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply to the submitter…"
        rows={4}
        maxLength={5000}
      />
      {!hasEmail ? (
        <Text size="xs" variant="muted">
          This submitter has no email on file — the reply is recorded in the thread but not emailed.
        </Text>
      ) : null}
      <Stack direction="row" align="end" justify="between" className="flex-wrap gap-3">
        <Stack gap={2} className="w-full sm:w-auto">
          <Label htmlFor="reply-status">Also set status</Label>
          <NativeSelect
            id="reply-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="sm:w-56"
          >
            <option value="">Keep “{feedbackStatusLabel(currentStatus)}”</option>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {feedbackStatusLabel(s)}
              </option>
            ))}
          </NativeSelect>
        </Stack>
        <Button type="button" color="primary" onClick={send} disabled={pending} loading={pending}>
          Send reply
        </Button>
      </Stack>
    </Stack>
  );
}
