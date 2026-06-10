'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api, type ApiRestError } from '@/lib/api-rest-client';

// Update the tenant's general settings via api-rest. The role gate and
// audit trail live in the api-rest route (`PATCH /v1/tenant`, requires
// admin role). Schema validation still happens here so the form error
// surfaces inline without a round-trip.

// Site-wide social links — an ordered { platform, url }[] (the form submits the
// whole list as JSON in the hidden `socials` field). `platform` is a known key
// or a free-text "Other" label; mirrors the api-rest PatchTenant schema.
const SocialLink = z.object({
  platform: z.string().min(1).max(40),
  url: z.string().min(1).max(2048),
});

const TenantUpdateSchema = z.object({
  name: z.string().min(1, 'Site name is required.').max(255),
  email: z.string().email('Enter a valid email address.').max(255),
  socials: z.array(SocialLink).max(50),
});

// Parse the hidden `socials` JSON field into a clean { platform, url }[],
// dropping anything malformed or incomplete (defensive — the client already
// filters, and the PATCH REPLACES the whole array).
function parseSocials(raw: FormDataEntryValue | null): { platform: string; url: string }[] {
  if (typeof raw !== 'string' || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { platform, url } = item as Record<string, unknown>;
    const p = typeof platform === 'string' ? platform.trim() : '';
    const u = typeof url === 'string' ? url.trim() : '';
    return p && u ? [{ platform: p, url: u }] : [];
  });
}

export interface UpdateGeneralResult {
  ok: boolean;
  error?: string;
}

export async function updateGeneralSettings(formData: FormData): Promise<UpdateGeneralResult> {
  const parsed = TenantUpdateSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    socials: parseSocials(formData.get('socials')),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  try {
    await api.patch<{ id: string }>('/v1/tenant', parsed.data);
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Update failed.' };
  }

  revalidatePath('/settings/general');
  return { ok: true };
}
