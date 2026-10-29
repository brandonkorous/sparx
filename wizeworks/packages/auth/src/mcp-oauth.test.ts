// The MCP server's door check for OAuth access tokens. Real EdDSA keys, real
// signatures, the token shape @better-auth/oauth-provider 1.7 issues (typ
// at+jwt, kid = jwks row id, sub/aud/client_id/scope/iat/exp); only the
// database behind it is replaced, by a store holding exactly the rows a real
// connection leaves.

import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type KeyObject } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./prisma', () => ({ authPrisma: {} }));

import { verifyMcpOAuthTokenWith, type McpOAuthStore } from './mcp-oauth';

const ISSUER = 'https://app.sparx.example';
const AUDIENCE = 'https://mcp.sparx.example/mcp';
const EXPECTED = { issuer: ISSUER, audience: AUDIENCE };
const TENANT = randomUUID();
const USER = randomUUID();
const CLIENT = 'claude-connector';
const KID = randomUUID();
const NOW = new Date('2026-10-29T12:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

let privateKey: CryptoKey | KeyObject;
let publicJwk: string;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = JSON.stringify(await exportJWK(pair.publicKey));
});

interface Connection {
  /** When the person approved the client; null = no consent row (revoked). */
  consentedAt: Date | null;
}

function store(conn: Connection): McpOAuthStore {
  return {
    findSigningKey: (kid) =>
      Promise.resolve(kid === KID ? { publicKey: publicJwk, alg: 'EdDSA' } : null),
    findConsentedTenant: ({ userId, clientId, issuedAt }) =>
      Promise.resolve(
        userId === USER &&
          clientId === CLIENT &&
          conn.consentedAt !== null &&
          conn.consentedAt <= issuedAt
          ? TENANT
          : null
      ),
    findOpaqueToken: () => Promise.resolve(null),
  };
}

const connected = (): McpOAuthStore => store({ consentedAt: new Date((nowSec - 600) * 1000) });

function mint(
  overrides: { aud?: string; iss?: string; iat?: number; exp?: number; typ?: string } = {}
) {
  const iat = overrides.iat ?? nowSec - 60;
  return new SignJWT({ client_id: CLIENT, azp: CLIENT, scope: 'openid read:products' })
    .setProtectedHeader({ alg: 'EdDSA', kid: KID, typ: overrides.typ ?? 'at+jwt' })
    .setSubject(USER)
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(overrides.exp ?? iat + 3600)
    .setJti(randomUUID())
    .sign(privateKey);
}

describe('verifyMcpOAuthTokenWith', () => {
  it('accepts a valid token and resolves the tenant and scopes', async () => {
    const result = await verifyMcpOAuthTokenWith(await mint(), EXPECTED, connected(), NOW);
    expect(result).toEqual({
      tenantId: TENANT,
      userId: USER,
      clientId: CLIENT,
      scopes: ['openid', 'read:products'],
    });
  });

  it('refuses a token issued for another MCP server', async () => {
    const token = await mint({ aud: 'https://mcp.other-brand.example/mcp' });
    expect(await verifyMcpOAuthTokenWith(token, EXPECTED, connected(), NOW)).toBeNull();
  });

  it('refuses a token from another authorization server', async () => {
    const token = await mint({ iss: 'https://evil.example' });
    expect(await verifyMcpOAuthTokenWith(token, EXPECTED, connected(), NOW)).toBeNull();
  });

  it('refuses an expired token', async () => {
    const token = await mint({ iat: nowSec - 7200, exp: nowSec - 3600 });
    expect(await verifyMcpOAuthTokenWith(token, EXPECTED, connected(), NOW)).toBeNull();
  });

  it('refuses a token once the connection is revoked', async () => {
    const token = await mint();
    expect(
      await verifyMcpOAuthTokenWith(token, EXPECTED, store({ consentedAt: null }), NOW)
    ).toBeNull();
  });

  it('refuses a token minted before the current approval (disconnect, then reconnect)', async () => {
    const token = await mint({ iat: nowSec - 1200 });
    expect(await verifyMcpOAuthTokenWith(token, EXPECTED, connected(), NOW)).toBeNull();
  });

  it('refuses an ID token signed with the same key', async () => {
    const token = await mint({ typ: 'JWT' });
    expect(await verifyMcpOAuthTokenWith(token, EXPECTED, connected(), NOW)).toBeNull();
  });

  it('refuses a token whose signature does not match', async () => {
    const token = await mint();
    const [h, p] = token.split('.');
    const forged = `${h}.${p}.${'A'.repeat(86)}`;
    expect(await verifyMcpOAuthTokenWith(forged, EXPECTED, connected(), NOW)).toBeNull();
  });
});
