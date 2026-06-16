// Signed OAuth `state` for the Search Console connect flow (docs/50 §7).
//
// The browser leaves our origin for Google's consent screen and comes back to
// the dashboard callback, so the round-trip must carry — tamper-proof — WHO is
// connecting (tenant + user), WHICH site (property) they were authoring, and the
// exact redirect_uri Google used (the token exchange must replay the same one).
// We sign all of it into a short-lived HS256 JWT with the shared internal
// secret; the exchange route verifies it and confirms the tenant matches the
// authenticated caller (CSRF defense). Mirrors the Stripe Connect state token
// in routes/v1/tenant.ts.

import { SignJWT, jwtVerify } from 'jose';
import { forbidden } from '@sparx/api-core/errors';

import { env } from '../../env.js';

const KIND = 'gsc_oauth';
const TTL = '10m';

export interface OAuthState {
  tenantId: string;
  userId: string;
  propertyId: string;
  redirectUri: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

export async function signOAuthState(state: OAuthState): Promise<string> {
  return new SignJWT({
    kind: KIND,
    tid: state.tenantId,
    uid: state.userId,
    pid: state.propertyId,
    redirect_uri: state.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

/** Verify + decode the state token. Throws forbidden on a tampered, expired, or
 *  wrong-kind token. */
export async function verifyOAuthState(token: string): Promise<OAuthState> {
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, secret())).payload;
  } catch {
    throw forbidden('Invalid or expired Search Console connect token.');
  }
  if (
    payload.kind !== KIND ||
    typeof payload.tid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.pid !== 'string' ||
    typeof payload.redirect_uri !== 'string'
  ) {
    throw forbidden('Malformed Search Console connect token.');
  }
  return {
    tenantId: payload.tid,
    userId: payload.uid,
    propertyId: payload.pid,
    redirectUri: payload.redirect_uri,
  };
}
