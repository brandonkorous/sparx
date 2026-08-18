// What the browser is allowed to see of an accounting connection.
//
// `listConnections` returns the Prisma row, and that row carries the tenant's
// encrypted OAuth access and refresh tokens. `GET /v1/finance/accounting` used
// to hand that row straight to `ok()` — on a `viewer`-gated endpoint — so both
// ciphertexts were served to anyone who opened the accounting screen. It was
// invisible because the workbench's own `AccountingConnection` interface lists
// only the nine safe fields, and a type on the client is a claim about the wire
// rather than a filter on it.
//
// `toPublicConnection` is the allow-list that fixed it. These tests exist to
// make sure it stays one: the first is the specific regression, and the second
// is the general rule, so a token field added to the model under a new name is
// caught by the same test rather than needing someone to remember this file.

import { describe, expect, it } from 'vitest';

import { toPublicConnection } from './connections';

/** A fully-populated row, of the shape `storeCredentials` writes. Built by hand
 *  rather than imported from Prisma so the test states what it is guarding. */
function row() {
  return {
    id: '5f2b4b34-2d1e-4f5a-9c3b-9a1d6d3f0e11',
    tenantId: 'tenant-1',
    propertyId: null,
    provider: 'quickbooks_online',
    status: 'active',
    displayName: 'QuickBooks Online',
    externalId: '9341452181234567',
    accessTokenEnc: 'v1:9f8a7b6c:ZW5jcnlwdGVkLWFjY2Vzcy10b2tlbg==',
    refreshTokenEnc: 'v1:1a2b3c4d:ZW5jcnlwdGVkLXJlZnJlc2gtdG9rZW4=',
    tokenExpiresAt: new Date('2027-03-04T10:00:00.000Z'),
    scopes: ['com.intuit.quickbooks.accounting'],
    syncExpenses: true,
    syncInvoices: false,
    syncPayments: false,
    syncCadence: 'manual',
    syncFromDate: new Date('2027-01-01T00:00:00.000Z'),
    lastSyncAt: null,
    lastSyncStatus: null,
    lastError: null,
    settings: {},
    createdAt: new Date('2027-02-01T09:00:00.000Z'),
    updatedAt: new Date('2027-02-01T09:00:00.000Z'),
  } as unknown as Parameters<typeof toPublicConnection>[0];
}

describe('toPublicConnection', () => {
  it('drops the encrypted access and refresh tokens', () => {
    const projected = toPublicConnection(row()) as unknown as Record<string, unknown>;
    expect(projected).not.toHaveProperty('accessTokenEnc');
    expect(projected).not.toHaveProperty('refreshTokenEnc');
  });

  it('exposes exactly these fields and no others', () => {
    // An EXACT key set rather than a "does it look like a secret" regex, which
    // is the wrong shape twice: it passes anything named innocuously, and it
    // fails `tokenExpiresAt`, which is a timestamp we expose on purpose. (That
    // false positive is why this assertion reads the way it does — the regex
    // version was written first and immediately flagged a safe field.)
    //
    // Pinning the set means ANY new field trips this test until somebody adds
    // it here, which is the review gate: the failure asks "is this safe to send
    // to a browser?" at the moment the answer is being decided.
    expect(Object.keys(toPublicConnection(row())).sort()).toEqual([
      'connected',
      'createdAt',
      'displayName',
      'externalId',
      'id',
      'lastError',
      'lastSyncAt',
      'lastSyncStatus',
      'propertyId',
      'provider',
      'status',
      'syncCadence',
      'syncExpenses',
      'syncFromDate',
      'syncInvoices',
      'syncPayments',
      'tokenExpiresAt',
    ]);
  });

  it('carries no ciphertext in any value', () => {
    // Belt to the key set's braces: `encryptProviderSecret` emits a versioned
    // `v1:…` envelope, so a stored secret that reached the projection under any
    // name at all is recognisable by its value.
    for (const [key, value] of Object.entries(
      toPublicConnection(row()) as unknown as Record<string, unknown>
    )) {
      if (typeof value === 'string') {
        expect(value, `${key} carries ciphertext`).not.toMatch(/^v\d+:/);
      }
    }
  });

  it('reports connected from the stored grant, never from status', () => {
    // `status` is 'active' from the moment the row is created — which is BEFORE
    // the OAuth redirect. Inferring sign-in from it tells someone who abandoned
    // the consent screen that they are connected to QuickBooks.
    const noGrant = { ...row(), accessTokenEnc: null, status: 'active' };
    expect(noGrant.status).toBe('active');
    expect(toPublicConnection(noGrant).connected).toBe(false);
    expect(toPublicConnection(row()).connected).toBe(true);
  });

  it('keeps the fields the settings screen needs', () => {
    const projected = toPublicConnection(row());
    expect(projected.id).toBe('5f2b4b34-2d1e-4f5a-9c3b-9a1d6d3f0e11');
    expect(projected.provider).toBe('quickbooks_online');
    expect(projected.displayName).toBe('QuickBooks Online');
    expect(projected.syncFromDate).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    // The expiry is exposed on purpose — a "needs reconnecting" hint needs it,
    // and a timestamp is not a credential.
    expect(projected.tokenExpiresAt).toEqual(new Date('2027-03-04T10:00:00.000Z'));
  });
});
