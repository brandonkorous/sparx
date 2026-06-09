'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { Domain } from '@/lib/sites';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(err: unknown): ActionResult {
  return { ok: false, error: (err as ApiRestError).message ?? 'Something went wrong.' };
}

function revalidate() {
  revalidatePath('/settings/domains');
  revalidatePath('/settings/sites');
}

// ─── Search & availability ────────────────────────────────────────────────────

export interface DomainSuggestion {
  domain: string;
  tld: string;
  available: boolean;
  price: number;
  displayPrice: number;
  currency: string;
}

export interface DomainAvailability {
  domain: string;
  tld: string;
  available: boolean;
  price: number;
  displayPrice: number;
  currency: string;
}

export async function searchDomains(
  query: string
): Promise<{ ok: boolean; data?: DomainSuggestion[]; error?: string }> {
  if (!query.trim()) return { ok: true, data: [] };
  try {
    const data = await api.post<DomainSuggestion[]>('/v1/domains/search', {
      query: query.trim(),
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Search failed.' };
  }
}

export async function checkDomain(
  domain: string
): Promise<{ ok: boolean; data?: DomainAvailability; error?: string }> {
  try {
    const data = await api.post<DomainAvailability>('/v1/domains/check', { domain });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as ApiRestError).message ?? 'Availability check failed.' };
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

const ContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Enter a valid email.'),
  phone: z.string().min(5, 'Enter a valid phone number.'),
  address1: z.string().min(1, 'Address is required.'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  state: z.string().min(1, 'State / region is required.'),
  postalCode: z.string().min(1, 'Postal code is required.'),
  country: z.string().length(2, 'Enter a 2-letter country code (e.g. US).'),
});

const PurchaseSchema = z.object({
  domain: z.string().min(1),
  years: z.coerce.number().int().min(1).max(10),
  privacy: z.coerce.boolean(),
  propertyId: z.string().uuid('Select a site to attach this domain to.'),
  contact: ContactSchema,
});

export interface PurchaseResult {
  domain: Domain;
  orderId: string;
  expiresAt: string;
}

export async function purchaseDomain(
  formData: FormData
): Promise<ActionResult & { data?: PurchaseResult }> {
  const raw = {
    domain: formData.get('domain'),
    years: formData.get('years'),
    privacy: formData.get('privacy') === 'true',
    propertyId: formData.get('propertyId'),
    contact: {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address1: formData.get('address1'),
      address2: formData.get('address2') || undefined,
      city: formData.get('city'),
      state: formData.get('state'),
      postalCode: formData.get('postalCode'),
      country: formData.get('country'),
    },
  };

  const parsed = PurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  try {
    const result = await api.post<PurchaseResult>('/v1/domains/purchase', parsed.data);
    revalidate();
    return { ok: true, data: result };
  } catch (err) {
    return fail(err);
  }
}

// ─── Renew ────────────────────────────────────────────────────────────────────

export async function renewDomain(domainId: string, years: number): Promise<ActionResult> {
  if (!domainId || years < 1 || years > 10) return { ok: false, error: 'Invalid input.' };
  try {
    await api.post(`/v1/domains/${domainId}/renew`, { years });
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Privacy & auto-renew ─────────────────────────────────────────────────────

export async function togglePrivacy(domainId: string, enabled: boolean): Promise<ActionResult> {
  try {
    await api.patch(`/v1/domains/${domainId}/privacy`, { enabled });
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function toggleAutoRenew(domainId: string, enabled: boolean): Promise<ActionResult> {
  try {
    await api.patch(`/v1/domains/${domainId}/auto-renew`, { enabled });
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Transfer out ─────────────────────────────────────────────────────────────

export async function transferOut(domainId: string): Promise<ActionResult & { authCode?: string }> {
  try {
    const result = await api.post<{ authCode: string }>(`/v1/domains/${domainId}/transfer-out`);
    revalidate();
    return { ok: true, authCode: result.authCode };
  } catch (err) {
    return fail(err);
  }
}

// ─── Shared mutations (mirror sites/actions.ts) ───────────────────────────────

export async function disconnectDomain(domainId: string): Promise<ActionResult> {
  try {
    await api.delete(`/v1/domains/${domainId}`);
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function verifyDomain(domainId: string): Promise<ActionResult> {
  try {
    await api.post(`/v1/domains/${domainId}/verify`);
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function makeCanonical(domainId: string): Promise<ActionResult> {
  try {
    await api.patch(`/v1/domains/${domainId}`, { isCanonical: true });
    revalidate();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
