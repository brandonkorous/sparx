'use server';

// B2B account Server Actions — adapters over api-rest /v1/crm/b2b-accounts.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

interface B2bAccountResponse {
  id: string;
  status: string;
}

export async function createB2bAccountAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const account = await api.post<B2bAccountResponse>('/v1/crm/b2b-accounts', input);
    revalidatePath('/crm/b2b');
    return { id: account.id };
  });
}

export async function updateB2bAccountAction(
  accountId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const account = await api.patch<B2bAccountResponse>(`/v1/crm/b2b-accounts/${accountId}`, input);
    revalidatePath('/crm/b2b');
    revalidatePath(`/crm/b2b/${accountId}`);
    return { id: account.id };
  });
}

export async function bulkDeleteB2bAccountsAction(
  ids: string[]
): Promise<ActionResult<{ deleted: number }>> {
  return restAction(async () => {
    await Promise.all(ids.map((id) => api.delete<void>(`/v1/crm/b2b-accounts/${id}`)));
    revalidatePath('/crm/b2b');
    return { deleted: ids.length };
  });
}

export async function bulkSetB2bStatusAction(
  ids: string[],
  status: 'active' | 'credit_hold' | 'suspended' | 'inactive'
): Promise<ActionResult<{ updated: number }>> {
  return restAction(async () => {
    await Promise.all(
      ids.map((id) => api.patch<B2bAccountResponse>(`/v1/crm/b2b-accounts/${id}`, { status }))
    );
    revalidatePath('/crm/b2b');
    return { updated: ids.length };
  });
}

/** Credit-hold toggle — just a status flip on the B2B account row.
 *  Going through update() means the audit row + RLS check happen via the
 *  same path the rest of the form uses; a dedicated service method would
 *  add no invariant a status change doesn't already cover. */
export async function setB2bAccountStatusAction(
  accountId: string,
  status: 'active' | 'credit_hold' | 'suspended' | 'inactive'
): Promise<ActionResult<{ id: string; status: string }>> {
  return restAction(async () => {
    const account = await api.patch<B2bAccountResponse>(`/v1/crm/b2b-accounts/${accountId}`, {
      status,
    });
    revalidatePath('/crm/b2b');
    revalidatePath(`/crm/b2b/${accountId}`);
    return { id: account.id, status: account.status };
  });
}
