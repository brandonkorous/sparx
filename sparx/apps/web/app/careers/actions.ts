'use server';

// Server action for the /careers apply form. Runs on sparx/apps/web's server and calls
// the platform's own public API (POST /v1/public/careers/apply) server-to-server —
// so the browser never touches api-rest directly (no CORS, no exposed origin) and
// the visitor IP is forwarded as opt-in proof. The application (plus its résumé
// PDF) lands in the platform tenant, and the sparx team gets an email. Mirrors
// the /early waitlist action's constants + IP-forwarding idiom.

import { headers } from 'next/headers';

// In-cluster api-rest URL (same env the marketplace data layer reads); the public
// route needs no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The tenant that owns the careers pipeline (the platform/dogfood tenant).
// Configurable so it can be repointed without a code change; defaults to the
// intended slug. Set SPARX_PLATFORM_TENANT_SLUG in the app environment.
const PLATFORM_TENANT = process.env.SPARX_PLATFORM_TENANT_SLUG ?? 'wizeworks';

// Résumé cap — matches the API's 8 MB limit so an oversized file fails here with
// a friendly message instead of a 400 from the round-trip.
const MAX_RESUME_BYTES = 8 * 1024 * 1024;

// Lightweight, dependency-free validation — the public API does the authoritative
// zod validation server-side; this is just a UX guard before the round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: FormDataEntryValue | null, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export interface ApplicationState {
  status: 'idle' | 'success' | 'error';
  /** User-facing error copy on failure. */
  message?: string;
}

interface ResumePayload {
  filename: string;
  contentBase64: string;
}

// Résumé is optional at the API; the client enforces `required` where the role
// needs one. When a file is present, validate it here so a bad upload fails with
// a clear message before the round-trip. Returns the encoded payload, `null` when
// no file was attached, or an error string to surface to the applicant.
async function readResume(
  value: FormDataEntryValue | null
): Promise<ResumePayload | null | string> {
  if (!(value instanceof File) || value.size === 0) return null;
  const isPdf = value.type === 'application/pdf' || value.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Your résumé must be a PDF file.';
  if (value.size > MAX_RESUME_BYTES) return 'Your résumé is too large (8 MB max).';
  const buf = Buffer.from(await value.arrayBuffer());
  return { filename: value.name, contentBase64: buf.toString('base64') };
}

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData
): Promise<ApplicationState> {
  // Honeypot — a hidden field real users never see. A bot that fills it gets a
  // silent success and writes nothing.
  const honeypot = formData.get('website');
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { status: 'success' };
  }

  const roleSlug = field(formData.get('roleSlug'), 120);
  const roleTitle = field(formData.get('roleTitle'), 255);
  const fullName = field(formData.get('fullName'), 255);
  const email = field(formData.get('email'), 255);
  const phone = field(formData.get('phone'), 50);
  const location = field(formData.get('location'), 255);
  const linkedinUrl = field(formData.get('linkedinUrl'), 500);
  const portfolioUrl = field(formData.get('portfolioUrl'), 500);
  const coverLetter = field(formData.get('coverLetter'), 20000);
  const roleInterest = field(formData.get('roleInterest'), 255);

  if (!roleSlug || !roleTitle) {
    return { status: 'error', message: 'Something went wrong. Please reload and try again.' };
  }
  if (!fullName) {
    return { status: 'error', message: 'Please enter your name.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  const resumeResult = await readResume(formData.get('resume'));
  if (typeof resumeResult === 'string') {
    return { status: 'error', message: resumeResult };
  }
  const resume = resumeResult ?? undefined;

  // Forward the visitor IP: this action runs server-side, so request.ip at the API
  // would otherwise be the sparx/apps/web pod, not the applicant.
  const h = await headers();
  const forwardedFor = h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '';

  try {
    const res = await fetch(
      `${API_BASE}/v1/public/careers/apply?tenant=${encodeURIComponent(PLATFORM_TENANT)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        body: JSON.stringify({
          roleSlug,
          roleTitle,
          fullName,
          email,
          ...(phone ? { phone } : {}),
          ...(location ? { location } : {}),
          ...(linkedinUrl ? { linkedinUrl } : {}),
          ...(portfolioUrl ? { portfolioUrl } : {}),
          ...(coverLetter ? { coverLetter } : {}),
          ...(roleInterest ? { roleInterest } : {}),
          ...(resume ? { resume } : {}),
        }),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
    }
    return { status: 'success' };
  } catch {
    return { status: 'error', message: 'Something went wrong on our end. Please try again.' };
  }
}
