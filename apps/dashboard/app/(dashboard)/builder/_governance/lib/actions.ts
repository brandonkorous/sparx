'use server';

// Server-action adapter over api-rest for the Builder governance surface. Server
// actions inherit the session + JWT (held only on the dashboard server) and
// integrate with revalidatePath, so the editor never talks to api-rest from the
// browser. Mirrors _brand/lib/actions.ts.

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { AllowlistDto, AllowlistRuleDto } from './types';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Full-replace the tenant's ADDITIONAL allowlist block rules. An empty list
 *  clears the tightening (the tenant inherits the platform base only). */
export async function updateAllowlist(
  blocks: AllowlistRuleDto[]
): Promise<ActionResult<AllowlistDto>> {
  try {
    const data = await api.put<AllowlistDto>('/v1/builder/governance/allowlist', { blocks });
    revalidatePath('/builder/governance', 'page');
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not save the allowlist.' };
  }
}
