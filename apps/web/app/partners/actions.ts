'use server';

// Server action for the /partners application (docs/114 §B.2). Runs on apps/web's
// server and calls the platform's own public API server-to-server (POST
// /v1/public/partners/apply) — so the browser never touches api-rest directly.
// EVERY application lands in the review queue — no tier auto-approves (no unvetted
// account represents the brand). Honeypot-guarded; the public API does the
// authoritative Zod pass.

import type { PartnerKind, PartnerTier } from '@/lib/partners';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KINDS: PartnerKind[] = ['freelance', 'agency', 'developer', 'other'];
const TIERS: PartnerTier[] = ['informal', 'registered', 'certified'];

function field(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export interface ApplyState {
  /** idle → not submitted; pending → application received, awaiting review;
   *  error → validation/transport failure. No tier auto-activates. */
  status: 'idle' | 'pending' | 'error';
  /** The tier applied for — echoed so the confirmation can tailor its copy. */
  tier?: PartnerTier;
  message?: string;
}

export async function applyToPartnerProgram(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  // Honeypot — a hidden field real users never fill. A bot that trips it gets a
  // silent success and writes nothing.
  const honeypot = formData.get('company_url');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'pending' };
  }

  const name = field(formData.get('name'), 255);
  const email = field(formData.get('email'), 255);
  const websiteUrl = field(formData.get('websiteUrl'), 500);
  const note = field(formData.get('note'), 2000);
  const kindRaw = field(formData.get('kind'), 32) as PartnerKind;
  const tierRaw = field(formData.get('requestedTier'), 32) as PartnerTier;
  const kind = KINDS.includes(kindRaw) ? kindRaw : 'other';
  const requestedTier = TIERS.includes(tierRaw) ? tierRaw : 'informal';

  if (!name) return { status: 'error', message: 'Please tell us your name.' };
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  try {
    const res = await fetch(`${API_BASE}/v1/public/partners/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        ...(websiteUrl ? { websiteUrl } : {}),
        kind,
        ...(note ? { note } : {}),
        requestedTier,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
    }
    // Every application is queued for review — the response is always pending.
    return { status: 'pending', tier: requestedTier };
  } catch {
    return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
  }
}
