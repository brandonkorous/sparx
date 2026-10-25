import { describe, expect, it } from 'vitest';
import { authConnectionUrl } from './auth-pool';

// WW-1 / SI-1: authPrisma opened a full default pool in every process with
// @wizeworks/auth, and DB_CONNECTION_LIMIT never reached it.

const URL_BASE = 'postgresql://sparx_owner:p%40ss@h:5432/sparx?schema=public';

describe('authConnectionUrl', () => {
  it('caps an unset auth pool at 1', () => {
    expect(authConnectionUrl(URL_BASE, {})).toBe(`${URL_BASE}&connection_limit=1`);
  });

  it('uses AUTH_DB_CONNECTION_LIMIT, not DB_CONNECTION_LIMIT', () => {
    expect(
      authConnectionUrl(URL_BASE, { AUTH_DB_CONNECTION_LIMIT: '3', DB_CONNECTION_LIMIT: '9' })
    ).toBe(`${URL_BASE}&connection_limit=3`);
  });

  it('leaves a URL that names its own limit alone', () => {
    const url = `${URL_BASE}&connection_limit=5`;
    expect(authConnectionUrl(url, { AUTH_DB_CONNECTION_LIMIT: '2' })).toBe(url);
  });
});
