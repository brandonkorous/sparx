'use server';

import { revalidatePath } from 'next/cache';
import { UpdatePartnerProfileInput } from '@sparx/partner-schemas';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Update the partner's public directory profile (docs/114 §B.7) via
// `PUT /v1/partner/profile`. The admin role gate lives in the api-rest route;
// validation runs here with the shared Zod schema so field errors surface inline.

export interface FieldError {
  field: string;
  message: string;
}

export interface UpdateProfileResult {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldError[];
}

export async function updatePartnerProfileAction(input: unknown): Promise<UpdateProfileResult> {
  const parsed = UpdatePartnerProfileInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? ''),
        message: i.message,
      })),
    };
  }

  try {
    await api.put('/v1/partner/profile', parsed.data);
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Could not save your profile.' };
  }

  revalidatePath('/partner/profile');
  revalidatePath('/partner');
  return { ok: true };
}
