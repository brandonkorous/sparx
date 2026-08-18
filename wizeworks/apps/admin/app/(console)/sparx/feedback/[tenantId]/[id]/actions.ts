'use server';

// Feedback triage write actions (Slice 7): triage (status/assignee/tags) and staff
// reply. Both re-check feedback:respond SERVER-SIDE, audit against the target
// tenant, and revalidate the detail + inbox. The reply publishes
// `feedback.responded` (email + in-app unread) inside api-rest, not here.

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import {
  OperatorApiError,
  type OperatorFeedbackReplyInput,
  type OperatorFeedbackTriageInput,
} from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';

export type FeedbackActionResult = { ok: true; message: string } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof OperatorApiError ? err.message : 'Something went wrong. Please try again.';
}

export async function triageFeedbackAction(
  tenantId: string,
  submissionId: string,
  input: OperatorFeedbackTriageInput
): Promise<FeedbackActionResult> {
  const operator = await requireCapability('feedback:respond');
  try {
    const result = await operatorApi().triageFeedback(tenantId, submissionId, input, operator.id);
    try {
      await logOperatorAction({
        operatorId: operator.id,
        operatorEmail: operator.email,
        capability: 'feedback:respond',
        action: 'feedback.triage',
        targetTenantId: tenantId,
        diff: {
          submissionId,
          status: result.status,
          assigneeStaffId: result.assigneeStaffId,
          internalTags: result.internalTags,
        },
      });
    } catch {
      // best-effort audit
    }
    revalidatePath(`/sparx/feedback/${tenantId}/${submissionId}`);
    revalidatePath('/sparx/feedback');
    return { ok: true, message: 'Feedback updated.' };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function replyFeedbackAction(
  tenantId: string,
  submissionId: string,
  input: OperatorFeedbackReplyInput
): Promise<FeedbackActionResult> {
  const operator = await requireCapability('feedback:respond');
  try {
    // The author snapshot is the staff member's own name (api-rest can't read it).
    const withAuthor: OperatorFeedbackReplyInput = {
      ...input,
      authorName: operator.name ?? operator.email,
    };
    const result = await operatorApi().replyFeedback(
      tenantId,
      submissionId,
      withAuthor,
      operator.id
    );
    try {
      await logOperatorAction({
        operatorId: operator.id,
        operatorEmail: operator.email,
        capability: 'feedback:respond',
        action: 'feedback.reply',
        targetTenantId: tenantId,
        diff: { submissionId, status: result.status, notified: Boolean(result.submitterEmail) },
      });
    } catch {
      // best-effort audit
    }
    revalidatePath(`/sparx/feedback/${tenantId}/${submissionId}`);
    revalidatePath('/sparx/feedback');
    return {
      ok: true,
      message: result.submitterEmail ? 'Reply sent to the submitter.' : 'Reply posted.',
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
