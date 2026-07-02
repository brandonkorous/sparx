'use server';

import { revalidatePath } from 'next/cache';
import { JoinPartnerInput } from '@sparx/partner-schemas';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Self-serve "Become a partner" (docs/114 §B.2). Provisions the `partners` row for
// the current org via `POST /v1/partner/join`: informal activates instantly + mints
// a referral code; registered/certified create a pending row and queue a review
// application. The role gate (admin) lives in the api-rest route; we validate here
// with the shared Zod schema so the form surfaces errors without a round-trip.

export interface JoinResult {
  ok: boolean;
  error?: string;
  /** The resulting status, so the client can tailor the confirmation. */
  status?: 'active' | 'pending';
}

export async function joinPartnerAction(input: {
  displayName: string;
  requestedTier: string;
  kind: string;
}): Promise<JoinResult> {
  const parsed = JoinPartnerInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  try {
    const partner = await api.post<{ status: 'active' | 'pending' }>(
      '/v1/partner/join',
      parsed.data
    );
    // The portal, rail tile, and section nav all key off the layout's partner
    // fetch — revalidate the whole dashboard tree so they light up immediately.
    revalidatePath('/', 'layout');
    return { ok: true, status: partner.status };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not join the program.' };
  }
}
