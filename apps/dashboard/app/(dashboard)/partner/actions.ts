'use server';

import { revalidatePath } from 'next/cache';
import { JoinPartnerInput } from '@sparx/partner-schemas';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Apply to the Partner Program (docs/114 §B.2). ALWAYS submits an application for
// staff review via `POST /v1/partner/apply` — there is NO automatic signup at any
// tier (no unvetted account represents the Sparx brand). Staff approval (admin
// app) is what provisions the `partners` row. The role gate (admin) lives in the
// api-rest route; we validate here with the shared Zod schema so the form surfaces
// errors without a round-trip.

export interface ApplyResult {
  ok: boolean;
  error?: string;
  status?: 'pending';
}

export async function applyForPartnerAction(input: {
  displayName: string;
  requestedTier: string;
  kind: string;
}): Promise<ApplyResult> {
  const parsed = JoinPartnerInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  try {
    const result = await api.post<{ status: 'pending' }>('/v1/partner/apply', parsed.data);
    // Re-render the shell so the join surface flips to its "in review" state.
    revalidatePath('/', 'layout');
    return { ok: true, status: result.status };
  } catch (err) {
    return {
      ok: false,
      error: (err as ApiRestError).message ?? 'Could not submit your application.',
    };
  }
}
