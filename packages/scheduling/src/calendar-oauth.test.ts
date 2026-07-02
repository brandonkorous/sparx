import { describe, expect, it } from 'vitest';

import {
  GOOGLE_CALENDAR_SCOPES,
  MICROSOFT_CALENDAR_SCOPES,
  buildCalendarAuthorizeUrl,
  buildTokenExchangeBody,
  buildTokenRefreshBody,
  calendarTokenUrl,
  isAccessTokenExpired,
  microsoftTenant,
  parseTokenResponse,
} from './calendar-oauth';

describe('buildCalendarAuthorizeUrl', () => {
  it('builds a Google consent URL with offline access + forced consent', () => {
    const url = new URL(
      buildCalendarAuthorizeUrl({
        provider: 'google',
        clientId: 'cid.apps.googleusercontent.com',
        redirectUri: 'https://app.example/cb',
        state: 'signed-state',
      })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('cid.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_CALENDAR_SCOPES.join(' '));
  });

  it('builds a Microsoft consent URL on the requested directory tenant', () => {
    const url = new URL(
      buildCalendarAuthorizeUrl({
        provider: 'microsoft',
        clientId: 'ms-client',
        redirectUri: 'https://app.example/cb',
        state: 'st',
        msTenant: 'contoso.onmicrosoft.com',
        loginHint: 'staff@contoso.com',
      })
    );
    expect(url.pathname).toBe('/contoso.onmicrosoft.com/oauth2/v2.0/authorize');
    expect(url.searchParams.get('response_mode')).toBe('query');
    expect(url.searchParams.get('scope')).toBe(MICROSOFT_CALENDAR_SCOPES.join(' '));
    expect(url.searchParams.get('login_hint')).toBe('staff@contoso.com');
  });

  it('defaults Microsoft to the common directory', () => {
    const url = new URL(
      buildCalendarAuthorizeUrl({
        provider: 'microsoft',
        clientId: 'ms-client',
        redirectUri: 'https://app.example/cb',
        state: 'st',
      })
    );
    expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');
  });
});

describe('microsoftTenant', () => {
  it('falls back to common for blank/null', () => {
    expect(microsoftTenant(null)).toBe('common');
    expect(microsoftTenant('  ')).toBe('common');
    expect(microsoftTenant('org-id')).toBe('org-id');
  });
});

describe('calendarTokenUrl', () => {
  it('returns the right token endpoint per provider', () => {
    expect(calendarTokenUrl('google')).toBe('https://oauth2.googleapis.com/token');
    expect(calendarTokenUrl('microsoft', 'common')).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    );
  });
});

describe('buildTokenExchangeBody / buildTokenRefreshBody', () => {
  it('exchanges a code (Google: no scope echoed)', () => {
    const body = new URLSearchParams(
      buildTokenExchangeBody({
        provider: 'google',
        clientId: 'cid',
        clientSecret: 'sec',
        code: 'auth-code',
        redirectUri: 'https://app.example/cb',
      })
    );
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_secret')).toBe('sec');
    expect(body.has('scope')).toBe(false);
  });

  it('exchanges a code (Microsoft echoes scope)', () => {
    const body = new URLSearchParams(
      buildTokenExchangeBody({
        provider: 'microsoft',
        clientId: 'cid',
        clientSecret: 'sec',
        code: 'auth-code',
        redirectUri: 'https://app.example/cb',
      })
    );
    expect(body.get('scope')).toBe(MICROSOFT_CALENDAR_SCOPES.join(' '));
  });

  it('refreshes with the stored refresh token', () => {
    const body = new URLSearchParams(
      buildTokenRefreshBody({
        provider: 'google',
        clientId: 'cid',
        clientSecret: 'sec',
        refreshToken: 'r3fr3sh',
      })
    );
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('r3fr3sh');
  });
});

describe('parseTokenResponse', () => {
  const now = Date.UTC(2026, 5, 20, 12, 0, 0);

  it('computes absolute expiry from expires_in', () => {
    const t = parseTokenResponse(
      { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'a b' },
      now
    );
    expect(t.accessToken).toBe('at');
    expect(t.refreshToken).toBe('rt');
    expect(t.expiresAtMs).toBe(now + 3600 * 1000);
    expect(t.scope).toBe('a b');
  });

  it('keeps null refresh token when the provider omits one (Google refresh)', () => {
    const t = parseTokenResponse({ access_token: 'at2', expires_in: 1000 }, now);
    expect(t.refreshToken).toBeNull();
  });

  it('defaults expiry to 1h when expires_in is missing/garbage', () => {
    const t = parseTokenResponse({ access_token: 'at3' }, now);
    expect(t.expiresAtMs).toBe(now + 3600 * 1000);
  });

  it('throws a readable error on an error response', () => {
    expect(() =>
      parseTokenResponse({ error: 'invalid_grant', error_description: 'code expired' }, now)
    ).toThrow(/code expired/);
    expect(() => parseTokenResponse({ error: 'invalid_grant' }, now)).toThrow(/invalid_grant/);
  });
});

describe('isAccessTokenExpired', () => {
  const now = 1_000_000;
  it('treats null/absent expiry as expired', () => {
    expect(isAccessTokenExpired(null, now)).toBe(true);
    expect(isAccessTokenExpired(undefined, now)).toBe(true);
  });
  it('refreshes within the skew window before true expiry', () => {
    expect(isAccessTokenExpired(now + 60_000, now, 120_000)).toBe(true); // 1m left, 2m skew
    expect(isAccessTokenExpired(now + 300_000, now, 120_000)).toBe(false); // 5m left
  });
});
