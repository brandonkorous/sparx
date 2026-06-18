'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';
import type { DraftReorderResult } from '../reorder/_components/types';

// Reorder Server Action (docs/100 P3d). Drafting POs from reorder suggestions
// creates draft purchase orders the buyer then reviews/submits — revalidate the
// reorder view (suggestions shrink as drafts are made) and the PO list.

export async function draftReorderAction(
  input: unknown
): Promise<ActionResult<DraftReorderResult>> {
  return restAction(async () => {
    const result = await api.post<DraftReorderResult>('/v1/inventory/reorder/draft', input);
    revalidatePath('/inventory/reorder');
    revalidatePath('/inventory/purchase-orders');
    return result;
  });
}
