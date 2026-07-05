// Client-side contact-form submit. A thin fetch wrapper over the public site-forms
// endpoint, via the same-origin /api/sparx proxy. Runs in the browser (the Builder
// "Contact form" block, docs/115). The tenant/site slugs + page slug are supplied
// by the storefront runtime bridge — the form itself never composes routing.

const API_BASE = '/api/sparx';

export interface ContactSubmitInput {
  /** Stable Builder node id of the form. */
  nodeId: string;
  /** Field values keyed by field name (name/email/phone/message). */
  values: Record<string, string>;
  /** Hidden anti-bot field — empty for a human. */
  honeypot?: string;
}

/** Submit a contact form. Resolves on success; throws with the API's message on
 *  failure. The endpoint returns success even for spam/duplicates, so the caller
 *  simply shows its thank-you. */
export async function submitContactForm(
  tenantSlug: string,
  propertySlug: string | undefined,
  pageSlug: string | null,
  input: ContactSubmitInput
): Promise<void> {
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
    }),
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true }
    | { success: false; error: { message: string; code: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message =
      body?.success === false ? body.error.message : `Couldn’t send your message (${res.status}).`;
    throw new Error(message);
  }
}
