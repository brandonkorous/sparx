'use server';

// Document-workflow + stage Server Actions (docs/87 §3) — adapters over api-rest
// /v1/invoicing/workflows. A document workflow is the tenant-configured lifecycle
// a billing document moves through (Estimate → Approved → Invoiced → Paid); each
// stage carries the customer-facing label and the behavior (number, snapshot,
// lock) that drives the document. Mirrors the CRM pipeline actions.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

interface WorkflowRef {
  id: string;
  slug: string;
}
interface StageRef {
  id: string;
}

const listPath = '/invoicing/workflows';
const editPath = (id: string) => `/invoicing/workflows/${id}/edit`;

export async function createWorkflowAction(
  input: unknown
): Promise<ActionResult<{ id: string; slug: string }>> {
  return restAction(async () => {
    const wf = await api.post<WorkflowRef>('/v1/invoicing/workflows', input);
    revalidatePath(listPath);
    return { id: wf.id, slug: wf.slug };
  });
}

export async function updateWorkflowAction(
  workflowId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const wf = await api.patch<WorkflowRef>(`/v1/invoicing/workflows/${workflowId}`, input);
    revalidatePath(listPath);
    revalidatePath(editPath(workflowId));
    return { id: wf.id };
  });
}

export async function archiveWorkflowAction(
  workflowId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/invoicing/workflows/${workflowId}`);
    revalidatePath(listPath);
    return { id: workflowId };
  });
}

export async function createWorkflowStageAction(
  workflowId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const stage = await api.post<StageRef>(`/v1/invoicing/workflows/${workflowId}/stages`, input);
    revalidatePath(editPath(workflowId));
    return { id: stage.id };
  });
}

export async function updateWorkflowStageAction(
  workflowId: string,
  stageId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const stage = await api.patch<StageRef>(
      `/v1/invoicing/workflows/${workflowId}/stages/${stageId}`,
      input
    );
    revalidatePath(editPath(workflowId));
    return { id: stage.id };
  });
}

export async function deleteWorkflowStageAction(
  workflowId: string,
  stageId: string
): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/invoicing/workflows/${workflowId}/stages/${stageId}`);
    revalidatePath(editPath(workflowId));
  });
}

export async function reorderWorkflowStagesAction(
  workflowId: string,
  input: unknown
): Promise<ActionResult<{ workflowId: string }>> {
  return restAction(async () => {
    await api.post<void>(`/v1/invoicing/workflows/${workflowId}/stages/reorder`, input);
    revalidatePath(editPath(workflowId));
    return { workflowId };
  });
}
