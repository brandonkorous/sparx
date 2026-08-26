'use server';

// Server action behind "Email this to me" on every free-tool page (docs/152 A3).
//
// It runs on Piggles' own server and calls the platform's public API
// server-to-server, so the browser never touches api-rest (no CORS, no exposed
// origin) and the visitor's IP is forwarded as opt-in proof rather than the
// pod's.
//
// The API does the authoritative validation, derives the tool's NAME and LINK
// from its own table (never from this request), resolves which brand is sending
// from the tenant's own record, and decides whether a contact is recorded. This
// file's only jobs are shaping the payload, forwarding the IP, and turning a
// failure into a sentence a person can act on.
//
// This is a deliberate near-twin of sparx's own tools action rather than shared
// code: `piggles/apps/web` may not import from `sparx/`, and the shared half —
// the endpoint, the email template, the delivery gate — already lives in
// `wizeworks/`, which is where sharing belongs.

import { headers } from 'next/headers';

/** Where api-rest is, from inside a Piggles pod. Same convention as
 *  `@piggles/config`'s notice fetcher: a laptop that configures nothing talks to
 *  the laptop, and in-cluster the service name comes from the environment. */
const API_BASE =
  process.env.PIGGLES_API_REST_URL?.trim().replace(/\/$/, '') ?? 'http://localhost:3100';

/** The tenant these pages belong to. Its `platformBrand` is what makes the email
 *  sign off as Piggles and link back to the Piggles site, so this must name the
 *  Piggles tenant rather than any other. Set PIGGLES_PLATFORM_TENANT_SLUG in the
 *  app environment. */
const PLATFORM_TENANT = process.env.PIGGLES_PLATFORM_TENANT_SLUG ?? 'piggles';

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

/** A form field as text. A FormData entry can also be a File, which stringifies
 *  to "[object Object]" — so anything that is not text reads as empty. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function sendToolResult(
  _prev: ToolDeliveryState,
  formData: FormData
): Promise<ToolDeliveryState> {
  // Honeypot — a hidden field real people never see. A bot that fills it gets a
  // silent success and nothing is sent.
  if (field(formData, 'website').trim() !== '') {
    return { status: 'success', email: field(formData, 'email') };
  }

  const email = field(formData, 'email').trim().slice(0, 255);
  const toolSlug = field(formData, 'toolSlug').slice(0, 63);
  const rawLines = field(formData, 'lines');
  const note = field(formData, 'note').slice(0, 2000);

  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'That does not look like an email address. Have a look?' };
  }

  let lines: ToolResultLine[];
  try {
    const parsed: unknown = JSON.parse(rawLines);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
    lines = parsed as ToolResultLine[];
  } catch {
    // Reached when the tool reported nothing — the button is disabled in that
    // state, so this is the belt to that braces rather than an everyday path.
    return {
      status: 'error',
      message: 'Fill in the tool first and we will send you what it makes.',
    };
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
      return { status: 'error', message: 'That did not send, and it is our end. Try again?' };
    }
    return { status: 'success', email };
  } catch {
    return { status: 'error', message: 'That did not send, and it is our end. Try again?' };
  }
}
