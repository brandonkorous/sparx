// api-rest serves both brands' sign-in from one process. These prove each
// brand's settings come from that brand's own variables, that a brand with no
// secret refuses to start, and that one brand's instance can never be driven
// from inside the other brand's request. No database is reached.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

import { authBrandConfigForBrand } from './brand-config';
import {
  auth,
  authForBrand,
  brandSignInOptions,
  registerAuthBrands,
  registeredAuthBrands,
} from './server';

const TOUCHED = [
  'PLATFORM_BRAND_SOURCE',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'SPARX_BETTER_AUTH_SECRET',
  'SPARX_BETTER_AUTH_URL',
  'PIGGLES_BETTER_AUTH_SECRET',
  'PIGGLES_BETTER_AUTH_URL',
  'PIGGLES_BETTER_AUTH_COOKIE_PREFIX',
  'PIGGLES_BETTER_AUTH_APP_NAME',
] as const;
const saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));

function restore() {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

describe('authBrandConfigForBrand', () => {
  afterEach(restore);

  it("reads a brand's values from its own prefixed variables", () => {
    process.env.PIGGLES_BETTER_AUTH_SECRET = 'piggles-secret';
    process.env.PIGGLES_BETTER_AUTH_URL = 'https://getpiggles.com/api/auth';
    process.env.PIGGLES_BETTER_AUTH_COOKIE_PREFIX = 'piggles-account';
    process.env.PIGGLES_BETTER_AUTH_APP_NAME = 'Piggles';
    const config = authBrandConfigForBrand('Piggles');
    expect(config).toMatchObject({
      brand: 'piggles',
      secret: 'piggles-secret',
      baseURL: 'https://getpiggles.com/api/auth',
      cookiePrefix: 'piggles-account',
      appName: 'Piggles',
    });
  });

  it("never borrows the default brand's unprefixed secret for another brand", () => {
    process.env.BETTER_AUTH_SECRET = 'sparx-secret';
    process.env.BETTER_AUTH_URL = 'https://app.sparx.works/api/auth';
    delete process.env.PIGGLES_BETTER_AUTH_SECRET;
    delete process.env.PIGGLES_BETTER_AUTH_URL;
    expect(() => authBrandConfigForBrand('piggles')).toThrow(/PIGGLES_BETTER_AUTH_SECRET/);
  });

  it('lets the default brand fall back to the unprefixed variables', () => {
    delete process.env.SPARX_BETTER_AUTH_SECRET;
    delete process.env.SPARX_BETTER_AUTH_URL;
    process.env.BETTER_AUTH_SECRET = 'sparx-secret';
    process.env.BETTER_AUTH_URL = 'https://app.sparx.works/api/auth';
    expect(authBrandConfigForBrand('sparx')).toMatchObject({
      brand: 'sparx',
      secret: 'sparx-secret',
      cookiePrefix: 'better-auth',
    });
  });
});

describe('registered brands', () => {
  const config = (brand: string) => ({
    brand,
    appName: brand,
    baseURL: `https://${brand}.example/api/auth`,
    secret: `${brand}-secret-that-is-long-enough-for-better-auth`,
    cookiePrefix: `${brand}-cookie`,
    googleClientId: undefined,
    googleClientSecret: undefined,
    passkeyRpId: undefined,
  });

  beforeAll(() => {
    registerAuthBrands([config('sparx'), config('piggles')]);
  });
  afterEach(restore);

  it('lists the brands it serves', () => {
    expect(registeredAuthBrands().sort()).toEqual(['piggles', 'sparx']);
  });

  it('builds a separate instance per brand', () => {
    const piggles = runAsBrand('piggles', () => authForBrand('piggles'));
    const sparx = runAsBrand('sparx', () => authForBrand('sparx'));
    expect(piggles).not.toBe(sparx);
    expect(piggles.options.advanced?.cookiePrefix).toBe('piggles-cookie');
    expect(sparx.options.advanced?.cookiePrefix).toBe('sparx-cookie');
  });

  it("refuses one brand's instance inside the other brand's request", () => {
    expect(() => runAsBrand('sparx', () => authForBrand('piggles'))).toThrow(
      /inside a "sparx" request scope/
    );
  });

  it("resolves the shared `auth` to the request's brand", () => {
    const prefix = runAsBrand('piggles', () => auth.options.advanced?.cookiePrefix);
    expect(prefix).toBe('piggles-cookie');
  });

  it('fails closed outside a scope in request mode', () => {
    process.env.PLATFORM_BRAND_SOURCE = 'request';
    expect(() => auth.options).toThrow(/Refusing to guess a brand/);
  });

  it('refuses a brand it was not given', () => {
    expect(() => runAsBrand('acme', () => authForBrand('acme'))).toThrow(
      /does not serve brand "acme"/
    );
  });
});

describe('brandSignInOptions', () => {
  // Registered on its own: the brands above have no Google client, and a
  // brand's registration replaces the earlier one under the same key.
  beforeAll(() => {
    registerAuthBrands([
      {
        brand: 'sparx',
        appName: 'sparx',
        baseURL: 'https://sparx.example/api/auth',
        secret: 'sparx-secret-that-is-long-enough-for-better-auth',
        cookiePrefix: 'sparx-cookie',
        googleClientId: 'sparx-google-id',
        googleClientSecret: 'sparx-google-secret',
        passkeyRpId: undefined,
      },
      {
        brand: 'piggles',
        appName: 'piggles',
        baseURL: 'https://piggles.example/api/auth',
        secret: 'piggles-secret-that-is-long-enough-for-better-auth',
        cookiePrefix: 'piggles-cookie',
        googleClientId: 'piggles-google-id',
        googleClientSecret: undefined,
        passkeyRpId: undefined,
      },
    ]);
  });

  it("answers with the brand's own Google client, never the process's", () => {
    expect(brandSignInOptions('sparx')).toEqual({
      social: ['google'],
      googleClientId: 'sparx-google-id',
    });
  });

  it('offers no Google for a brand missing half of its credentials', () => {
    expect(brandSignInOptions('Piggles')).toEqual({ social: [], googleClientId: null });
  });

  it('refuses a brand it was not given', () => {
    expect(() => brandSignInOptions('acme')).toThrow(/does not serve brand "acme"/);
  });
});
