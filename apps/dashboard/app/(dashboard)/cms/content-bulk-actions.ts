'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './actions';

export async function bulkPublishEntriesAction(ids: string[]): Promise<ActionResult> {
  try {
    await Promise.all(ids.map((id) => api.post(`/v1/content/entries/${id}/publish`)));
    revalidatePath('/cms/content');
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message ?? 'Failed to publish entries.' };
  }
}

export async function bulkArchiveEntriesAction(ids: string[]): Promise<ActionResult> {
  try {
    await Promise.all(ids.map((id) => api.post(`/v1/content/entries/${id}/unpublish`)));
    revalidatePath('/cms/content');
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message ?? 'Failed to archive entries.' };
  }
}

export async function bulkDeleteEntriesAction(ids: string[]): Promise<ActionResult> {
  try {
    await Promise.all(ids.map((id) => api.delete(`/v1/content/entries/${id}`)));
    revalidatePath('/cms/content');
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message ?? 'Failed to delete entries.' };
  }
}
