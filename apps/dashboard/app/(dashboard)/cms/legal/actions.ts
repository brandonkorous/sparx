'use server';

// Server actions for the CMS → Legal surface (docs/42 §3.5). Thin wrappers
// over the authed api-rest endpoints + a revalidate so the checklist refreshes.

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';

export type LegalActionResult = { ok: true } | { ok: false; error: string };

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export async function createLegalPage(legalKind: string): Promise<LegalActionResult> {
  try {
    await api.post('/v1/legal/pages', { legalKind });
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath('/cms/legal');
  return { ok: true };
}

export async function addLegalPlacement(entryId: string): Promise<LegalActionResult> {
  try {
    await api.post('/v1/legal/placements', { entryId });
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath('/cms/legal');
  return { ok: true };
}

export async function acknowledgeLegalPage(entryId: string): Promise<LegalActionResult> {
  try {
    await api.post(`/v1/legal/pages/${entryId}/acknowledge`);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath('/cms/legal');
  return { ok: true };
}

export interface ConsentSettingsInput {
  mode: 'off' | 'gdpr' | 'ccpa';
  activeCategories: string[];
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug: string;
}

export async function saveConsentSettings(input: ConsentSettingsInput): Promise<LegalActionResult> {
  try {
    await api.patch('/v1/tenant/consent', input);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath('/cms/legal');
  return { ok: true };
}
