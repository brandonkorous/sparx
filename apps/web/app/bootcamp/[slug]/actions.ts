'use server';

// Server action for the internal bootcamp RSVP (docs/114 §B.5, D6). Runs on
// apps/web's server and POSTs to the platform's own public API
// (POST /v1/public/bootcamps/:slug/register) — which reserves the seat AND
// creates a lead in the HOST partner's CRM (the graduate-attribution + dogfood
// hook). Waitlists past capacity. Honeypot-guarded; the public API does the
// authoritative Zod pass. The slug rides as a hidden form field.

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export interface RsvpState {
  status: 'idle' | 'registered' | 'waitlisted' | 'error';
  message?: string;
}

export async function registerForBootcamp(
  _prev: RsvpState,
  formData: FormData
): Promise<RsvpState> {
  // Honeypot — a hidden field real users never fill.
  const honeypot = formData.get('company_url');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'registered' };
  }

  const slug = field(formData.get('slug'), 200);
  const name = field(formData.get('name'), 255);
  const email = field(formData.get('email'), 255);
  const seatsRaw = Number.parseInt(field(formData.get('seats'), 3) || '1', 10);
  const seats = Number.isFinite(seatsRaw) ? Math.min(10, Math.max(1, seatsRaw)) : 1;

  if (!slug)
    return { status: 'error', message: 'Something went wrong. Please refresh and try again.' };
  if (!name) return { status: 'error', message: 'Please tell us your name.' };
  if (!EMAIL_RE.test(email))
    return { status: 'error', message: 'Please enter a valid email address.' };

  try {
    const res = await fetch(
      `${API_BASE}/v1/public/bootcamps/${encodeURIComponent(slug)}/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, seats }),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
    }
    const body = (await res.json()) as { status?: 'registered' | 'waitlisted' };
    return { status: body.status ?? 'registered' };
  } catch {
    return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
  }
}
