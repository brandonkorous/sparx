'use server';

// Server action behind "Email this to me" on every free-tool page (docs/152 A3).
//
// Mirrors the /early waitlist action deliberately: it runs on sparx/apps/web's
// server and calls the platform's own public API server-to-server, so the browser
// never touches api-rest (no CORS, no exposed origin) and the visitor's IP is
// forwarded as opt-in proof rather than the pod's.
//
// The API does the authoritative validation, derives the tool's NAME and LINK
// from its own table (never from this request), and decides whether a CRM contact
// is recorded. This file's only jobs are shaping the payload, forwarding the IP,
// and turning a failure into a sentence a person can act on.

import { headers } from 'next/headers';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
const PLATFORM_TENANT = process.env.SPARX_PLATFORM_TENANT_SLUG ?? 'wizeworks';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One computed output line. Never file content — see the API route's header. */
export interface ToolResultLine {
  label: string;
  value: string;
}

export interface ToolDeliveryState {
  status: 'idle' | 'success' | 'error';
  /** Echoed back on success so the confirmation can name the address. */
  email?: string;
  message?: string;
}

export async function sendToolResult(
  _prev: ToolDeliveryState,
  formData: FormData
): Promise<ToolDeliveryState> {
  // Honeypot — a hidden field real people never see. A bot that fills it gets a
  // silent success and nothing is sent.
  const honeypot = formData.get('website');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'success', email: String(formData.get('email') ?? '') };
  }

  const email = String(formData.get('email') ?? '')
    .trim()
    .slice(0, 255);
  const toolSlug = String(formData.get('toolSlug') ?? '').slice(0, 63);
  const rawLines = String(formData.get('lines') ?? '');
  const note = String(formData.get('note') ?? '').slice(0, 2000);

  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  let lines: ToolResultLine[];
  try {
    const parsed: unknown = JSON.parse(rawLines);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
    lines = parsed as ToolResultLine[];
  } catch {
    // Reached when the tool reported nothing — the button is disabled in that
    // state, so this is the belt to that braces rather than an everyday path.
    return { status: 'error', message: 'Fill in the tool first and we will send you the result.' };
  }

  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '';

  try {
    const res = await fetch(
      `${API_BASE}/v1/public/tools/deliver?tenant=${encodeURIComponent(PLATFORM_TENANT)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        // No brand field: the API resolves it from the tenant's own
        // `platformBrand`, so the sign-off and the link back cannot disagree
        // with who the tenant actually belongs to.
        body: JSON.stringify({ email, toolSlug, lines, ...(note ? { note } : {}) }),
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
