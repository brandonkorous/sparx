// Public chat-availability reader for the marketplace "Chat with {publisher}"
// CTA (docs/72 §"Chat module integration"). Server-only, mirroring lib/marketplace:
// it reads the UNAUTHENTICATED api-rest surface over the in-cluster origin.
//
// The public config route (`GET /v1/public/chat/config?tenant=slug`) is gated by
// `publicChatContext` → `isModuleEnabled(tenant, 'chat')`, so it 404s when the
// publisher tenant hasn't activated chat. A 2xx therefore means "chat is live for
// this tenant" — exactly the signal the CTA needs to avoid rendering a dead button.

// In-cluster api-rest URL (same var the marketplace data layer uses); the public
// routes need no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export interface PublicChatAvailability {
  /** Always true when present — the route only answers for chat-active tenants. */
  enabled: boolean;
  /** Live online/away flag derived from the tenant's operating hours. */
  online: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Whether `tenantSlug` has the chat module live (and its online state), or null
 *  when chat is off / the tenant is unknown / the API is unreachable. Cached for
 *  5 minutes to match the listing page's `revalidate`. */
export async function fetchChatAvailability(
  tenantSlug: string
): Promise<PublicChatAvailability | null> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/public/chat/config?tenant=${encodeURIComponent(tenantSlug)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<PublicChatAvailability>;
    if (!body.success || !body.data?.enabled) return null;
    return { enabled: body.data.enabled, online: body.data.online };
  } catch {
    return null;
  }
}
