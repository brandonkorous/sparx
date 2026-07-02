'use server';

// Server action for the /partners self-serve application (docs/114 §B.2). Runs on
// apps/web's server and calls the platform's own public API server-to-server
// (POST /v1/public/partners/apply) — so the browser never touches api-rest
// directly. Informal applications auto-approve; registered/certified land in the
// review queue. Honeypot-guarded; the public API does the authoritative Zod pass.

import type { PartnerKind, PartnerTier } from '@/lib/partners';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KINDS: PartnerKind[] = ['freelance', 'agency', 'developer', 'other'];
const TIERS: PartnerTier[] = ['informal', 'registered', 'certified'];

function field(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export interface ApplyState {
  /** idle → not submitted; approved → informal, activate now; pending →
   *  reviewed tier, we'll be in touch; error → validation/transport failure. */
  status: 'idle' | 'approved' | 'pending' | 'error';
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
    const body = (await res.json()) as { status?: 'approved' | 'pending' };
    // Trust the API's decision, but fall back to the tier rule if it's silent
    // (informal auto-approves; everything else is reviewed).
    const decided = body.status ?? (requestedTier === 'informal' ? 'approved' : 'pending');
    return { status: decided, tier: requestedTier };
  } catch {
    return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
  }
}
