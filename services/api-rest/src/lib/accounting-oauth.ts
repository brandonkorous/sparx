// Signed OAuth `state` for the accounting connect flow (docs/146 Phase 10.7–10.8).
//
// The browser leaves our origin for QuickBooks' or Xero's consent screen and
// comes back to the workbench callback, so the round trip has to carry —
// tamper-proof — WHICH provider, WHO is connecting, WHICH connection row the
// grant belongs to, and the exact `redirect_uri` that was used (the token
// exchange must replay the same string or both providers reject it).
//
// Signed as a short-lived HS256 JWT with the shared internal secret; the
// callback verifies it and confirms the tenant matches the authenticated caller.
// That last check is the CSRF defence: without it, an attacker's consent
// redirect could attach THEIR accounting company to somebody else's tenant, and
// the next journal would post a stranger's stock movements into their books.
//
// Deliberately a near-copy of `social-oauth.ts` rather than a shared generic. The
// two carry different payloads (a social connection is per-site and per-platform;
// this is per-connection-row) and the generalisation that fitted both would be a
// bag of optional fields — which is how a signed token grows a field that one
// caller checks and the other does not.

import { SignJWT, jwtVerify } from 'jose';
import { forbidden } from '@sparx/api-core/errors';

import { env } from '../env.js';

const KIND = 'accounting_oauth';
const TTL = '10m';

export interface AccountingOAuthState {
  provider: string;
  tenantId: string;
  userId: string;
  /** The connection row the grant will be written into. Created BEFORE the
   *  redirect, so the callback has somewhere to put the token and a half-finished
   *  connect leaves a visible, deletable row rather than nothing at all. */
  connectionId: string;
  redirectUri: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

export async function signAccountingOAuthState(state: AccountingOAuthState): Promise<string> {
  return new SignJWT({
    kind: KIND,
    provider: state.provider,
    tid: state.tenantId,
    uid: state.userId,
    cid: state.connectionId,
    redirect_uri: state.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

export async function verifyAccountingOAuthState(token: string): Promise<AccountingOAuthState> {
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, secret())).payload;
  } catch {
    throw forbidden('That accounting connect link has expired. Start again.');
  }
  if (
    payload.kind !== KIND ||
    typeof payload.provider !== 'string' ||
    typeof payload.tid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.cid !== 'string' ||
    typeof payload.redirect_uri !== 'string'
  ) {
    throw forbidden('That accounting connect link is not valid.');
  }
  return {
    provider: payload.provider,
    tenantId: payload.tid,
    userId: payload.uid,
    connectionId: payload.cid,
    redirectUri: payload.redirect_uri,
  };
}
