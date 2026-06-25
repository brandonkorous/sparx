// Signed OAuth `state` for the channel connect flow (docs/106 §4.6).
//
// The browser leaves our origin for the channel's consent screen and returns to
// the dashboard callback, so the round-trip must carry — tamper-proof — WHICH
// channel + WHO is connecting (tenant + user) + the exact redirect_uri the channel
// used (the token exchange must replay the same one). We sign it into a short-
// lived HS256 JWT with the shared internal secret; the callback verifies it and
// confirms the tenant matches the authenticated caller (CSRF defense). Mirrors the
// Search Console + Stripe Connect state tokens.

import { SignJWT, jwtVerify } from 'jose';
import { forbidden } from '@sparx/api-core/errors';
import type { ChannelSlug } from '@sparx/channels';

import { env } from '../env.js';

const KIND = 'channel_oauth';
const TTL = '10m';

export interface ChannelOAuthState {
  slug: ChannelSlug;
  tenantId: string;
  userId: string;
  redirectUri: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);
}

export async function signChannelOAuthState(state: ChannelOAuthState): Promise<string> {
  return new SignJWT({
    kind: KIND,
    slug: state.slug,
    tid: state.tenantId,
    uid: state.userId,
    redirect_uri: state.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

/** Verify + decode the state token. Throws forbidden on a tampered, expired, or
 *  wrong-kind token. */
export async function verifyChannelOAuthState(token: string): Promise<ChannelOAuthState> {
  let payload: Record<string, unknown>;
  try {
    payload = (await jwtVerify(token, secret())).payload;
  } catch {
    throw forbidden('Invalid or expired channel connect token.');
  }
  if (
    payload.kind !== KIND ||
    typeof payload.slug !== 'string' ||
    typeof payload.tid !== 'string' ||
    typeof payload.uid !== 'string' ||
    typeof payload.redirect_uri !== 'string'
  ) {
    throw forbidden('Malformed channel connect token.');
  }
  return {
    slug: payload.slug as ChannelSlug,
    tenantId: payload.tid,
    userId: payload.uid,
    redirectUri: payload.redirect_uri,
  };
}
