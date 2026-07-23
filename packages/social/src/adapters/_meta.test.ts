import { describe, expect, it } from 'vitest';

import { buildMetaConnectUrl, classifyMediaContainerStatus, waitForContainer } from './_meta.js';

// The shared Meta helpers' pure decision logic (docs/133 §6). Network calls (token
// exchange, Page listing) are integration surface; here we lock the authorize URL, the
// container-status mapping, and the polling loop.

describe('buildMetaConnectUrl', () => {
  it('builds a Facebook Login authorize URL with the requested scope + state', () => {
    const url = new URL(
      buildMetaConnectUrl(
        { clientId: 'app-123', clientSecret: 'secret' },
        {
          tenantId: 't1',
          state: 'signed-state',
          redirectUri: 'https://app.example.com/social/callback',
          scopes: [],
        },
        'pages_manage_posts,instagram_content_publish'
      )
    );
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v21.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toContain('instagram_content_publish');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/social/callback');
  });
});

describe('classifyMediaContainerStatus', () => {
  it('maps FINISHED → ready', () => {
    expect(classifyMediaContainerStatus('FINISHED')).toEqual({ ready: true, failed: false });
  });
  it('maps ERROR / EXPIRED → failed', () => {
    expect(classifyMediaContainerStatus('ERROR')).toEqual({ ready: false, failed: true });
    expect(classifyMediaContainerStatus('EXPIRED')).toEqual({ ready: false, failed: true });
  });
  it('treats IN_PROGRESS / unknown as still processing', () => {
    expect(classifyMediaContainerStatus('IN_PROGRESS')).toEqual({ ready: false, failed: false });
    expect(classifyMediaContainerStatus(undefined)).toEqual({ ready: false, failed: false });
  });
});

describe('waitForContainer', () => {
  const noSleep = () => Promise.resolve();

  it('returns once the probe reports ready', async () => {
    let calls = 0;
    await waitForContainer(
      () => {
        calls += 1;
        return Promise.resolve({ ready: calls >= 3, failed: false });
      },
      { sleep: noSleep }
    );
    expect(calls).toBe(3);
  });

  it('throws immediately when the probe reports failed', async () => {
    await expect(
      waitForContainer(() => Promise.resolve({ ready: false, failed: true, detail: 'bad media' }), {
        sleep: noSleep,
      })
    ).rejects.toThrow(/bad media/);
  });

  it('throws after exhausting the attempt budget', async () => {
    await expect(
      waitForContainer(() => Promise.resolve({ ready: false, failed: false }), {
        attempts: 2,
        sleep: noSleep,
      })
    ).rejects.toThrow(/not ready after 2/);
  });
});
