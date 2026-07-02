'use server';

import { revalidatePath } from 'next/cache';
import { ApplyTierInput } from '@sparx/partner-schemas';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Apply for a higher partner tier (docs/114 §B.2) via `POST /v1/partner/tier/apply`
// — queues a staff-review application (informal needs none). Validated here with
// the shared schema; the admin role gate lives in the api-rest route.

export interface ApplyTierResult {
  ok: boolean;
  error?: string;
}

export async function applyTierAction(input: {
  requestedTier: string;
  note?: string | null;
}): Promise<ApplyTierResult> {
  const parsed = ApplyTierInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  try {
    await api.post('/v1/partner/tier/apply', parsed.data);
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not submit your request.' };
  }

  revalidatePath('/partner/tier');
  revalidatePath('/partner');
  return { ok: true };
}
