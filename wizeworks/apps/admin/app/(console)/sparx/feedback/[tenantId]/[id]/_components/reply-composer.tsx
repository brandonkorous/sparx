'use client';

import * as React from 'react';
import { Button, Stack, Text, toast } from '@wizeworks/ui';
import { Field, FieldControl, FieldLabel, NativeSelect, Textarea } from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@wizeworks/forms';
import type { OperatorFeedbackReplyInput } from '@wizeworks/operator';
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

  const v = useFieldValidation({ body }, { body: rule.required('Write a reply first.') });

  function send() {
    if (!v.validate()) return;
    const input: OperatorFeedbackReplyInput = {
      body: body.trim(),
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
      <Field {...v.field('body')}>
        <FieldControl
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          {...v.control('body')}
          render={<Textarea rows={4} placeholder="Write a reply to the submitter…" />}
          maxLength={5000}
        />
      </Field>
      {!hasEmail ? (
        <Text size="xs" variant="muted">
          This submitter has no email on file — the reply is recorded in the thread but not emailed.
        </Text>
      ) : null}
      <Stack direction="row" align="end" justify="between" className="flex-wrap gap-3">
        <Field className="w-full sm:w-auto">
          <FieldLabel>Also set status</FieldLabel>
          <FieldControl
            name="reply-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            render={
              <NativeSelect className="sm:w-56">
                <option value="">Keep “{feedbackStatusLabel(currentStatus)}”</option>
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {feedbackStatusLabel(s)}
                  </option>
                ))}
              </NativeSelect>
            }
          />
        </Field>
        <Button type="button" color="primary" onClick={send} disabled={pending} loading={pending}>
          Send reply
        </Button>
      </Stack>
    </Stack>
  );
}
