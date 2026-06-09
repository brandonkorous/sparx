'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

export async function createSurchargeRuleAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/surcharge-rules', input);
    revalidatePath('/commerce/surcharges');
    return result;
  });
}

export async function updateSurchargeRuleAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.patch<{ id: string }>(`/v1/surcharge-rules/${id}`, input);
    revalidatePath('/commerce/surcharges');
    return { ok: true as const };
  });
}

export async function deleteSurchargeRuleAction(id: string): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete(`/v1/surcharge-rules/${id}`);
    revalidatePath('/commerce/surcharges');
    return { ok: true as const };
  });
}
