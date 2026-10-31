import 'server-only';

import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';

// "Do you want to let this app in?": the MCP OAuth consent, through api-rest
// (docs/07 §5, docs/154). The signed query Better Auth sent the person here
// with can only be checked where its secret is, so api-rest reads it and
// applies the answer; this app draws the screen.

/** Where a refused answer's sentence rides back to the consent screen. Only
 *  this app reads it: api-rest takes only the signed parameters. */
export const CONSENT_ERROR_PARAM = 'consent_error';

/** A Next.js `searchParams` record as URLSearchParams, keeping repeated keys
 *  (`ba_param`, `resource`) in order. */
export function toSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): URLSearchParams {
  if (sp instanceof URLSearchParams) return sp;
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const v of value) out.append(key, v);
    else if (value !== undefined) out.append(key, value);
  }
  return out;
}

export interface McpConsentRequest {
  /** The signed query, passed back unchanged with the answer. */
  oauthQuery: string;
  clientName: string | null;
  redirectUri: string;
  requestedScopes: string[];
}

export type McpConsentRead =
  { ok: true; request: McpConsentRequest } | { ok: false; error: string };

/** Who is asking, and for what. `error` is a sentence the screen shows as-is. */
export function readMcpConsentRequest(search: URLSearchParams): Promise<McpConsentRead> {
  return platformRequest<McpConsentRead>(`mcp-consent?${search.toString()}`);
}

export type McpConsentAnswer =
  | { ok: true; next: string }
  | { ok: false; signedOut: true }
  | { ok: false; signedOut: false; error: string };

/** Send the person's answer. api-rest cuts the scopes to what their role may
 *  give. `next` is where Better Auth sends the browser now. */
export async function submitMcpConsent(input: {
  oauthQuery: string;
  accept: boolean;
  scopes: string[];
}): Promise<McpConsentAnswer> {
  try {
    const { next } = await platformRequest<{ next: string }>('mcp-consent', { body: input });
    return { ok: true, next };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 401) {
      return { ok: false, signedOut: true };
    }
    const message = err instanceof PlatformRequestError ? err.body.error : null;
    return {
      ok: false,
      signedOut: false,
      error:
        typeof message === 'string' && message
          ? message
          : 'This connection could not be completed. Start again from your assistant.',
    };
  }
}
