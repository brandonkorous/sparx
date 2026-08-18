'use server';

// Server action for the /early waitlist form. Runs on sparx/apps/web's server, calls
// the platform's own public API (POST /v1/public/newsletter) server-to-server —
// so the browser never touches api-rest directly (no CORS, no exposed origin) and
// the visitor IP is forwarded as opt-in proof. The record lands in the platform
// tenant's CRM (the dogfood tenant, docs/80 §2), tagged `early-access`.

import { headers } from 'next/headers';

// In-cluster api-rest URL (same env the marketplace data layer reads); the public
// route needs no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The tenant whose CRM holds platform marketing contacts. Configurable so the
// platform tenant can be renamed/repointed without a code change; defaults to the
// intended slug. Set SPARX_PLATFORM_TENANT_SLUG in the app environment.
const PLATFORM_TENANT = process.env.SPARX_PLATFORM_TENANT_SLUG ?? 'wizeworks';

// The named list this page joins — the broadcast-targetable "Early Access" slice.
const LIST = 'early-access';

// Lightweight, dependency-free validation — the public API does the authoritative
// zod validation server-side; this is just a UX guard before the round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export interface WaitlistState {
  status: 'idle' | 'success' | 'error';
  /** Echoed back on success so the confirmation can name the address. */
  email?: string;
  /** User-facing error copy on failure. */
  message?: string;
}

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  // Honeypot — a hidden field real users never see. A bot that fills it gets a
  // silent success and writes nothing.
  const honeypot = formData.get('website');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'success', email: field(formData.get('email'), 255) };
  }

  const email = field(formData.get('email'), 255);
  const name = field(formData.get('name'), 255);
  const building = field(formData.get('building'), 2000);
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  // Forward the visitor IP: this action runs server-side, so request.ip at the API
  // would otherwise be the sparx/apps/web pod, not the person opting in.
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '';

  try {
    const res = await fetch(
      `${API_BASE}/v1/public/newsletter?tenant=${encodeURIComponent(PLATFORM_TENANT)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        body: JSON.stringify({
          email,
          list: LIST,
          ...(name ? { firstName: name } : {}),
          ...(building ? { note: building } : {}),
        }),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
    }
    return { status: 'success', email };
  } catch {
    return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
  }
}
