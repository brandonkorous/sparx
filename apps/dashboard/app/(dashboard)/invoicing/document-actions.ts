'use server';

// Invoicing document Server Actions — adapters over api-rest /v1/invoicing/*.
// The document editor (line grid, stage bar, payments panel) calls these; every
// mutation revalidates the list + the document's detail page so the server-
// rendered editor reflects the new totals/status.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

interface DocRef {
  id: string;
  number: string | null;
}

const listPath = '/invoicing/documents';
const docPath = (id: string) => `/invoicing/documents/${id}`;

function revalidateDoc(id: string): void {
  revalidatePath(listPath);
  revalidatePath(docPath(id));
}

export async function createDocumentAction(
  input: unknown
): Promise<ActionResult<{ id: string; number: string | null }>> {
  return restAction(async () => {
    const doc = await api.post<DocRef>('/v1/invoicing/documents', input);
    revalidatePath(listPath);
    return { id: doc.id, number: doc.number };
  });
}

export async function updateDocumentAction(
  documentId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const doc = await api.patch<DocRef>(`/v1/invoicing/documents/${documentId}`, input);
    revalidateDoc(documentId);
    return { id: doc.id };
  });
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.delete<void>(`/v1/invoicing/documents/${documentId}`);
    revalidatePath(listPath);
  });
}

export async function addLineAction(
  documentId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const doc = await api.post<DocRef>(`/v1/invoicing/documents/${documentId}/lines`, input);
    revalidateDoc(documentId);
    return { id: doc.id };
  });
}

export async function updateLineAction(
  documentId: string,
  lineId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    await api.patch(`/v1/invoicing/documents/${documentId}/lines/${lineId}`, input);
    revalidateDoc(documentId);
    return { id: lineId };
  });
}

export async function removeLineAction(
  documentId: string,
  lineId: string
): Promise<ActionResult<void>> {
  return restAction(async () => {
    await api.delete(`/v1/invoicing/documents/${documentId}/lines/${lineId}`);
    revalidateDoc(documentId);
  });
}

export async function advanceStageAction(
  documentId: string,
  stageId: string
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const doc = await api.post<DocRef>(`/v1/invoicing/documents/${documentId}/advance`, {
      stageId,
    });
    revalidateDoc(documentId);
    return { id: doc.id };
  });
}

export async function recordPaymentAction(
  documentId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const doc = await api.post<DocRef>(`/v1/invoicing/documents/${documentId}/payments`, input);
    revalidateDoc(documentId);
    return { id: doc.id };
  });
}
