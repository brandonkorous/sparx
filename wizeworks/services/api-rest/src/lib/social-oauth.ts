// Signed OAuth `state` for the social connect flow (docs/133 §6).
//
// The browser leaves our origin for the platform's consent screen and returns to the
// dashboard callback, so the round-trip must carry — tamper-proof — WHICH platform +
// WHO is connecting (tenant + user) + the exact redirect_uri the platform used (the
// token exchange must replay the same one) + WHICH site the connection is for. We sign
// it into a short-lived HS256 JWT with the shared internal secret; the callback
// verifies it and confirms the tenant matches the authenticated caller (CSRF defense).
// Mirrors the channels connect state (`channels-oauth.ts`).

import { SignJWT, jwtVerify } from 'jose';
import { forbidden } from '@wizeworks/api-core/errors';
import type { SocialPlatform } from '@wizeworks/social';

import { env } from '../env.js';

const KIND = 'social_oauth';
const TTL = '10m';

export interface SocialOAuthState {
  platform: SocialPlatform;
  tenantId: string;
  userId: string;
  redirectUri: string;
  // The site this connection is being made FOR (docs/133 §5). Carried in the SIGNED
  // state, not re-derived at callback (which has no request context saying which site
  // the operator was on — guessing would attach an account to the wrong business).
  // Null = a tenant-wide connection.
  propertyId: string | null;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

export async function signSocialOAuthState(state: SocialOAuthState): Promise<string> {
  return new SignJWT({
    kind: KIND,
    platform: state.platform,
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
export async function verifySocialOAuthState(token: string): Promise<SocialOAuthState> {
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, secret())).payload;
  } catch {
    throw forbidden('Invalid or expired social connect token.');
  }
  if (
    payload.kind !== KIND ||
    typeof payload.platform !== 'string' ||
    typeof payload.tid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.redirect_uri !== 'string'
  ) {
    throw forbidden('Malformed social connect token.');
  }
  return {
    platform: payload.platform as SocialPlatform,
    tenantId: payload.tid,
    userId: payload.uid,
    propertyId: typeof payload.pid === 'string' ? payload.pid : null,
    redirectUri: payload.redirect_uri,
  };
}
