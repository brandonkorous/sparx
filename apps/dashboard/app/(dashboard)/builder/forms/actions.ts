'use server';

// Server actions for the Form submissions inbox (docs/115). Every call goes
// through api-rest (GET/PATCH/DELETE /v1/forms/submissions[/:id]); the builder
// module gate + RLS live there. Mutations revalidate the inbox so a return to
// the list reflects the new status.

import 'server-only';
import { revalidatePath } from 'next/cache';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  SUBMISSIONS_PAGE_SIZE,
  type FormSubmission,
  type FormSubmissionStatus,
  type SubmissionListResponse,
} from './types';

const INBOX_PATH = '/builder/forms';

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function toMessage(err: unknown): string {
  const e = err as ApiRestError;
  return e?.message ?? 'Something went wrong. Please try again.';
}

// Change a submission's status (mark read / unread / spam / archived). Used by
// the detail header actions.
export async function setSubmissionStatusAction(
  id: string,
  status: FormSubmissionStatus
): Promise<ActionResult<FormSubmission>> {
  try {
    const data = await api.patch<FormSubmission>(
      `/v1/forms/submissions/${encodeURIComponent(id)}`,
      { status }
    );
    revalidatePath(INBOX_PATH);
    revalidatePath(`${INBOX_PATH}/${id}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

// Permanently remove a submission. The caller confirms first (useConfirm).
export async function deleteSubmissionAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const data = await api.delete<{ id: string }>(
      `/v1/forms/submissions/${encodeURIComponent(id)}`
    );
    revalidatePath(INBOX_PATH);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

// Fetch the next page of submissions (cursor = the last row's id), for the
// list's "Load older messages" control. Read-only, so no revalidation.
export async function loadMoreSubmissionsAction(params: {
  status?: FormSubmissionStatus;
  cursor: string;
}): Promise<ActionResult<SubmissionListResponse>> {
  try {
    const query = new URLSearchParams();
    query.set('limit', String(SUBMISSIONS_PAGE_SIZE));
    query.set('cursor', params.cursor);
    if (params.status) query.set('status', params.status);
    const data = await api.get<SubmissionListResponse>(`/v1/forms/submissions?${query.toString()}`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}
