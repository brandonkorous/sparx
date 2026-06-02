'use server';

// Server action backing the platform-legal re-acceptance banner (docs/42 §6).

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';

export async function acceptCurrentLegal(
  docTypes: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api.post('/v1/me/legal-accept', { docTypes });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not record acceptance.',
    };
  }
  revalidatePath('/');
  return { ok: true };
}
