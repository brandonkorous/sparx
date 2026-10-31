// The sign-in flows that need more than Better Auth's own endpoints, as typed
// calls to api-rest's `/auth/<brand>/platform/*` (routes/auth/platform-flows.ts
// there). Each brand's sign-in app draws the screens; these are the calls
// behind them, the same in every app.

import { platformRequest, PlatformRequestError } from './platform-request';

// ── Which social sign-ins to offer ──────────────────────────────────────────

export interface SignInOptions {
  /** The social providers this brand can sign somebody in with. */
  social: string[];
  /** Google's public client id, for One Tap. Null when Google is not set up. */
  googleClientId: string | null;
}

/** The brand's social sign-ins, from api-rest, which holds the credentials.
 *  Never throws: if api-rest cannot be asked, sign-in through it cannot work
 *  either, so no button is offered rather than one drawn dead. */
export async function readSignInOptions(): Promise<SignInOptions> {
  try {
    return await platformRequest<SignInOptions>('sign-in-options');
  } catch {
    return { social: [], googleClientId: null };
  }
}

// ── The confirm-your-email link ─────────────────────────────────────────────

// A fresh confirm-your-email link for the person signed in. api-rest builds and
// sends it, always to that person's own address: a link sent wherever a form
// said would be a way to mail anyone a link from us.

export interface SendLinkResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/** `callbackURL` is where the link lands, a path on this app. Every failure is
 *  a sentence the screen shows as-is. */
export async function requestConfirmLink(callbackURL: string): Promise<SendLinkResult> {
  try {
    const sent = await platformRequest<{ ok: true; email: string }>('verification-email', {
      body: { callbackURL },
    });
    return { ok: true, email: sent.email };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 401) {
      return { ok: false, error: 'You are signed out. Sign in again, then ask for a new link.' };
    }
    const message = err instanceof PlatformRequestError ? err.body.error : null;
    return {
      ok: false,
      error:
        typeof message === 'string' && message
          ? message
          : 'The link didn’t send. Nothing changed. Try again in a minute.',
    };
  }
}

// ── Team invitations ────────────────────────────────────────────────────────

// A team invitation, read from api-rest (docs/154). Anyone holding the link may
// see who invited them and to what, which is what the email already said.

export interface InvitationDetail {
  id: string;
  email: string;
  organizationId: string;
  orgName: string;
  role: string;
  inviterName: string;
  status: string;
  expiresAt: Date;
}

/** The invitation, or null when there is none (or it belongs to another
 *  product's business, which reads the same). */
export async function readInvitation(id: string): Promise<InvitationDetail | null> {
  try {
    const { invitation } = await platformRequest<{
      invitation: Omit<InvitationDetail, 'expiresAt'> & { expiresAt: string };
    }>(`invitations/${encodeURIComponent(id)}`);
    return { ...invitation, expiresAt: new Date(invitation.expiresAt) };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 404) return null;
    throw err;
  }
}

// ── MCP OAuth consent ───────────────────────────────────────────────────────

// "Do you want to let this app in?": the MCP OAuth consent, through api-rest
// (docs/07 §5, docs/154). The signed query Better Auth sent the person here
// with can only be checked where its secret is, so api-rest reads it and
// applies the answer; the app draws the screen.

/** Where a refused answer's sentence rides back to the consent screen. Only
 *  the app reads it: api-rest takes only the signed parameters. */
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

/** The discovery document an assistant reads to find out how to connect, as
 *  api-rest built it for this brand. Asked without the visitor's cookies: it
 *  describes the server, not anybody's session. */
export function mcpDiscoveryDocument(kind: 'oauth' | 'openid'): Promise<unknown> {
  return platformRequest<unknown>(`mcp-discovery/${kind}`, { requestHeaders: new Headers() });
}
