// A store's door check for a shopper's assistant. Real EdDSA keys and real
// signatures in the token shape the 1.7 customer provider issues (typ at+jwt,
// kid = customer_jwks row, iss = <store>/v1/public/auth, aud = <store>/mcp);
// only the tenant-scoped tables behind it are replaced, by a store holding the
// rows one real connection leaves.

import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type KeyObject } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@wizeworks/db', () => ({ withTenant: vi.fn() }));

const { verifyCustomerMcpTokenWith } = await import('./mcp-verify');
type Store = Parameters<typeof verifyCustomerMcpTokenWith>[2];

const TENANT = randomUUID();
const STORE = 'https://shop.example';
const RESOURCE = `${STORE}/mcp`;
const ISSUER = `${STORE}/v1/public/auth`;
const SHOPPER = randomUUID();
const CLIENT = 'assistant-client';
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

function store(opts: { consentedAt: Date | null }): Store {
  return {
    findSigningKey: (kid) =>
      Promise.resolve(kid === KID ? { publicKey: publicJwk, alg: 'EdDSA' } : null),
    findResources: (ids) => Promise.resolve(ids.filter((id) => id === RESOURCE)),
    hasConsent: ({ userId, clientId, issuedAt }) =>
      Promise.resolve(
        userId === SHOPPER &&
          clientId === CLIENT &&
          opts.consentedAt !== null &&
          opts.consentedAt <= issuedAt
      ),
    findOpaqueToken: () => Promise.resolve(null),
  };
}

const connected = () => store({ consentedAt: new Date((nowSec - 600) * 1000) });

function mint(overrides: { aud?: string; iss?: string; iat?: number; exp?: number } = {}) {
  const iat = overrides.iat ?? nowSec - 60;
  return new SignJWT({ client_id: CLIENT, azp: CLIENT, scope: 'openid orders:read' })
    .setProtectedHeader({ alg: 'EdDSA', kid: KID, typ: 'at+jwt' })
    .setSubject(SHOPPER)
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? RESOURCE)
    .setIssuedAt(iat)
    .setExpirationTime(overrides.exp ?? iat + 3600)
    .sign(privateKey);
}

describe('verifyCustomerMcpTokenWith', () => {
  it('accepts a valid token for this store', async () => {
    expect(await verifyCustomerMcpTokenWith(TENANT, await mint(), connected(), NOW)).toEqual({
      tenantId: TENANT,
      userId: SHOPPER,
      clientId: CLIENT,
      scopes: ['openid', 'orders:read'],
    });
  });

  it('refuses a token for a server this store never registered', async () => {
    const token = await mint({ aud: 'https://elsewhere.example/mcp' });
    expect(await verifyCustomerMcpTokenWith(TENANT, token, connected(), NOW)).toBeNull();
  });

  it('refuses a token whose issuer is not the store it is for', async () => {
    const token = await mint({ iss: 'https://other-shop.example/v1/public/auth' });
    expect(await verifyCustomerMcpTokenWith(TENANT, token, connected(), NOW)).toBeNull();
  });

  it('refuses an expired token', async () => {
    const token = await mint({ iat: nowSec - 7200, exp: nowSec - 3600 });
    expect(await verifyCustomerMcpTokenWith(TENANT, token, connected(), NOW)).toBeNull();
  });

  it('refuses a token once the shopper removed the connection', async () => {
    const token = await mint();
    expect(
      await verifyCustomerMcpTokenWith(TENANT, token, store({ consentedAt: null }), NOW)
    ).toBeNull();
  });

  it('refuses a token signed by a key this store does not hold', async () => {
    const other = await generateKeyPair('EdDSA');
    const token = await new SignJWT({ client_id: CLIENT, scope: 'orders:read' })
      .setProtectedHeader({ alg: 'EdDSA', kid: randomUUID(), typ: 'at+jwt' })
      .setSubject(SHOPPER)
      .setIssuer(ISSUER)
      .setAudience(RESOURCE)
      .setIssuedAt(nowSec - 60)
      .setExpirationTime(nowSec + 3600)
      .sign(other.privateKey);
    expect(await verifyCustomerMcpTokenWith(TENANT, token, connected(), NOW)).toBeNull();
  });
});
