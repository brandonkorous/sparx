'use client';

import * as React from 'react';
import { Button, Checkbox, Input, Label, NativeSelect, Stack, Text, toast } from '@sparx/ui';
import type { OperatorFeedbackTriageInput } from '@sparx/operator';
import {
  FEEDBACK_STATUSES,
  feedbackStatusLabel,
  firstText,
  statusAlwaysNotifies,
} from '@/lib/feedback';
import { triageFeedbackAction } from '../actions';

// Locally-typed assignee option so this client component never imports the
// server-only @sparx/operator-auth (structurally matches its OperatorSummary).
interface AssigneeOption {
  id: string;
  email: string;
  name: string | null;
}

// Triage: status, assignee, and internal tags (staff-only). Save posts the whole
// set; the notify toggle only affects planned/in_progress (shipped/declined/
// answered always notify, triaged never — the server enforces the rule).
export function TriageControls({
  tenantId,
  submissionId,
  currentStatus,
  currentAssigneeId,
  currentTags,
  operators,
}: {
  tenantId: string;
  submissionId: string;
  currentStatus: string;
  currentAssigneeId: string | null;
  currentTags: string[];
  operators: AssigneeOption[];
}) {
  const [status, setStatus] = React.useState(currentStatus);
  const [assignee, setAssignee] = React.useState(currentAssigneeId ?? '');
  const [tags, setTags] = React.useState(currentTags.join(', '));
  const [notify, setNotify] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const statusChanged = status !== currentStatus;
  const notifyForced = statusChanged && statusAlwaysNotifies(status);
  const notifyOptional = statusChanged && (status === 'planned' || status === 'in_progress');

  function save() {
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const input: OperatorFeedbackTriageInput = {
      status: status as OperatorFeedbackTriageInput['status'],
      assigneeStaffId: assignee ? assignee : null,
      internalTags: parsedTags,
      notify: notifyOptional ? notify : undefined,
    };
    startTransition(async () => {
      const res = await triageFeedbackAction(tenantId, submissionId, input);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <Stack gap={4}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stack gap={2}>
          <Label htmlFor="triage-status">Status</Label>
          <NativeSelect
            id="triage-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {feedbackStatusLabel(s)}
              </option>
            ))}
          </NativeSelect>
        </Stack>
        <Stack gap={2}>
          <Label htmlFor="triage-assignee">Assignee</Label>
          <NativeSelect
            id="triage-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {firstText(o.name, o.email)}
              </option>
            ))}
          </NativeSelect>
        </Stack>
      </div>

      <Stack gap={2}>
        <Label htmlFor="triage-tags">Internal tags</Label>
        <Input
          id="triage-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="dup, mobile, quick-win"
        />
        <Text size="xs" variant="muted">
          Comma-separated, staff-only. Never shown to the submitter.
        </Text>
      </Stack>

      {notifyForced ? (
        <Text size="sm" variant="muted">
          Saving will email the submitter that their feedback is “{feedbackStatusLabel(status)}”.
        </Text>
      ) : notifyOptional ? (
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={notify}
            onCheckedChange={(v) => setNotify(v === true)}
            aria-label="Email the submitter"
          />
          <Text size="sm">Email the submitter about this status change</Text>
        </label>
      ) : null}

      <div>
        <Button type="button" color="primary" onClick={save} disabled={pending} loading={pending}>
          Save triage
        </Button>
      </div>
    </Stack>
  );
}
