'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@sparx/auth/server';

// "Your Sparx partner" mutation (docs/114 §B.7). Revoking a partner's access to
// this workspace is exactly removing the consultant `members` row — done through
// the Better Auth org plugin so its owner/admin permission check fires — scoped to
// the caller's ACTIVE org. It mirrors settings/team/actions.ts `removeMember` but
// revalidates this page. (A partner's referral ATTRIBUTION isn't touched here: a
// referral is a historical fact, not an access grant; this only cuts off the live
// consultant seat.)

export interface PartnerAccessResult {
  ok: boolean;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: { message?: string } }).body;
    if (body?.message) return body.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function revokePartnerAccess(memberId: string): Promise<PartnerAccessResult> {
  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not revoke access.') };
  }
  revalidatePath('/settings/partner');
  return { ok: true };
}
