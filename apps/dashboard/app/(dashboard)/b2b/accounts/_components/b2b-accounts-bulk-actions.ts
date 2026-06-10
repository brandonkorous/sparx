'use server';

// B2B Accounts — bulk actions (docs/68 B-3). Loops the existing CRM
// /v1/crm/b2b-accounts endpoints (PATCH status / DELETE soft-delete) so the
// fleet-level bulk bar reuses the single-record service + its RLS + audit.

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

export async function bulkSetB2bAccountStatusAction(
  ids: string[],
  status: 'active' | 'inactive'
): Promise<void> {
  await Promise.all(ids.map((id) => api.patch(`/v1/crm/b2b-accounts/${id}`, { status })));
  revalidatePath('/b2b/accounts');
}

export async function bulkDeleteB2bAccountsAction(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => api.delete(`/v1/crm/b2b-accounts/${id}`)));
  revalidatePath('/b2b/accounts');
}
