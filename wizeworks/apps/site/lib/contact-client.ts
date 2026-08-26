// Client-side contact-form submit. A thin fetch wrapper over the public site-forms
// endpoint, via the same-origin /api/sparx proxy. Runs in the browser (the Builder
// "Contact form" block, docs/115). The tenant/site slugs + page slug are supplied
// by the storefront runtime bridge — the form itself never composes routing.
//
// File attachments (docs/115 Part D) are a two-phase, proxied upload: for each file
// we ask the API for a signed upload URL, PUT the bytes (the server magic-sniffs
// them), and collect the signed token — then hand the tokens to the submit call. The
// bytes never touch the submit JSON, and the server trusts only the signed token.

const API_BASE = '/api/sparx';

/** What a quiz or calculator tells the visitor, as the API returns it. */
export interface QuizResultView {
  headline: string | null;
  body: string | null;
  amountLabel: string | null;
}

export interface ContactSubmitInput {
  /** Stable Builder node id of the form. */
  nodeId: string;
  /** Field values keyed by field name (name/email/phone/message). */
  values: Record<string, string>;
  /** Hidden anti-bot field — empty for a human. */
  honeypot?: string;
  /** Files the visitor attached — uploaded before the submit round-trip. */
  files?: File[];
}

interface UploadUrlResponse {
  success: boolean;
  data?: { uploadId: string; token: string; maxBytes: number; expiresAt: string };
  error?: { message: string; code: string };
}

/** Upload one attached file and return its signed token. Two hops, both proxied
 *  same-origin: mint an upload URL, then PUT the bytes. Throws with a friendly
 *  message on any failure (the caller surfaces it — a file the visitor chose is
 *  never silently dropped). */
async function uploadAttachment(
  tenantSlug: string,
  propertySlug: string | undefined,
  pageSlug: string | null,
  nodeId: string,
  file: File
): Promise<string> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  if (propertySlug) qs.set('property', propertySlug);

  const urlRes = await fetch(`${API_BASE}/v1/public/forms/upload-url?${qs.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      formNodeId: nodeId,
      pageSlug,
      filename: file.name,
      mimeType: file.type,
      byteSize: file.size,
    }),
  });
  const urlBody = (await urlRes.json().catch(() => null)) as UploadUrlResponse | null;
  if (!urlRes.ok || !urlBody?.success || !urlBody.data) {
    const message = urlBody?.error?.message ?? `Couldn’t prepare the upload for “${file.name}”.`;
    throw new Error(message);
  }
  const { uploadId, token } = urlBody.data;

  const putRes = await fetch(
    `${API_BASE}/v1/public/forms/upload/${uploadId}?token=${encodeURIComponent(token)}`,
    { method: 'PUT', headers: { 'content-type': file.type }, body: file }
  );
  if (!putRes.ok) {
    const putBody = (await putRes.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    throw new Error(putBody?.error?.message ?? `Couldn’t upload “${file.name}”.`);
  }
  return token;
}

/** Submit a contact form. Resolves on success; throws with the API's message on
 *  failure. The endpoint returns success even for spam/duplicates, so the caller
 *  simply shows its thank-you. Any attached files are uploaded first (sequentially,
 *  so an early failure surfaces before the submit). */
export async function submitContactForm(
  tenantSlug: string,
  propertySlug: string | undefined,
  pageSlug: string | null,
  input: ContactSubmitInput
): Promise<{ result: QuizResultView } | undefined> {
  const attachments: string[] = [];
  for (const file of input.files ?? []) {
    attachments.push(
      await uploadAttachment(tenantSlug, propertySlug, pageSlug, input.nodeId, file)
    );
  }

  const qs = new URLSearchParams({ tenant: tenantSlug });
  if (propertySlug) qs.set('property', propertySlug);
  const res = await fetch(`${API_BASE}/v1/public/forms/submit?${qs.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      formNodeId: input.nodeId,
      pageSlug,
      values: input.values,
      honeypot: input.honeypot,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true; data?: { result?: QuizResultView } }
    | { success: false; error: { message: string; code: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message =
      body?.success === false ? body.error.message : `Couldn’t send your message (${res.status}).`;
    throw new Error(message);
  }
  // A quiz or calculator answers back (docs/152 C3). Absent on an ordinary form,
  // and the caller falls through to its own thank-you.
  return body.data?.result ? { result: body.data.result } : undefined;
}

/**
 * Record a form somebody has started and not finished (docs/152 C2).
 *
 * Deliberately silent about failure. This is the tenant's measurement of their
 * own site, and it fires while a visitor is midway through typing — surfacing an
 * error, or letting one propagate, would interrupt somebody who has done nothing
 * wrong. A dropped partial costs the tenant one row; a visible error costs them
 * the lead.
 */
export async function capturePartialForm(
  tenantSlug: string,
  propertySlug: string | undefined,
  pageSlug: string | null,
  input: { nodeId: string; values: Record<string, string>; step: number; honeypot?: string }
): Promise<void> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  if (propertySlug) qs.set('property', propertySlug);
  try {
    await fetch(`${API_BASE}/v1/public/forms/partial?${qs.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The page may be closing — this is the moment somebody abandons a form,
      // and a normal fetch is cancelled on unload while keepalive survives it.
      keepalive: true,
      body: JSON.stringify({
        formNodeId: input.nodeId,
        pageSlug,
        values: input.values,
        step: input.step,
        ...(input.honeypot !== undefined ? { honeypot: input.honeypot } : {}),
      }),
    });
  } catch {
    /* see the note above — never surfaced */
  }
}
