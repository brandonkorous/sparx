import { describe, expect, it, vi, afterEach } from 'vitest';

import { createMailgunProvider, senderDomainOf } from './mailgun';
import type { SendableEmail } from '../types';

const DEFAULT_DOMAIN = 'default.example';
const SECOND_DOMAIN = 'second.example';

function message(from: string): SendableEmail {
  return {
    to: 'someone@customer.example',
    from,
    subject: 'Subject',
    html: '<p>Body</p>',
    text: 'Body',
  };
}

/** Capture the URL a send is posted to, without touching the network. */
function captureUrl(): { urls: string[]; restore: () => void } {
  const urls: string[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return Promise.resolve(
      new Response(JSON.stringify({ id: 'mailgun-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  });
  return { urls, restore: () => spy.mockRestore() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('senderDomainOf', () => {
  it('reads the domain out of a bare address', () => {
    expect(senderDomainOf('noreply@one.example')).toBe('one.example');
  });

  it('reads it out of a named address', () => {
    expect(senderDomainOf('Some Brand <noreply@one.example>')).toBe('one.example');
  });

  it('lowercases, so a differently-cased From still matches the allowlist', () => {
    expect(senderDomainOf('Brand <NoReply@One.Example>')).toBe('one.example');
  });

  it('returns null rather than guessing when there is no address', () => {
    expect(senderDomainOf('not an address')).toBeNull();
    expect(senderDomainOf('')).toBeNull();
  });
});

describe('createMailgunProvider — which domain a message is posted through', () => {
  const provider = () =>
    createMailgunProvider({
      apiKey: 'key',
      defaultDomain: DEFAULT_DOMAIN,
      domains: [SECOND_DOMAIN],
    });

  it('posts through the domain the From names, when it is one we are authorized for', async () => {
    const { urls } = captureUrl();
    await provider().send(message(`Second Brand <noreply@${SECOND_DOMAIN}>`));
    // The whole point: DKIM has to sign with the key that matches the address.
    expect(urls[0]).toContain(`/v3/${SECOND_DOMAIN}/messages`);
  });

  it('posts through the default when the From names a domain we cannot send for', async () => {
    const { urls } = captureUrl();
    await provider().send(message('Some Shop <hello@a-tenants-own-domain.example>'));
    expect(urls[0]).toContain(`/v3/${DEFAULT_DOMAIN}/messages`);
  });

  it('posts through the default when the From has no readable domain', async () => {
    const { urls } = captureUrl();
    await provider().send(message('nonsense'));
    expect(urls[0]).toContain(`/v3/${DEFAULT_DOMAIN}/messages`);
  });

  it('still routes the default domain through itself', async () => {
    const { urls } = captureUrl();
    await provider().send(message(`Brand <noreply@${DEFAULT_DOMAIN}>`));
    expect(urls[0]).toContain(`/v3/${DEFAULT_DOMAIN}/messages`);
  });

  it('a single-domain account behaves exactly as it did before', async () => {
    const { urls } = captureUrl();
    const single = createMailgunProvider({ apiKey: 'key', defaultDomain: DEFAULT_DOMAIN });
    await single.send(message(`Second Brand <noreply@${SECOND_DOMAIN}>`));
    expect(urls[0]).toContain(`/v3/${DEFAULT_DOMAIN}/messages`);
  });
});

describe('createMailgunProvider — a tenant relaying through their own domain', () => {
  const provider = () => createMailgunProvider({ apiKey: 'key', defaultDomain: DEFAULT_DOMAIN });

  it('relays through the domain the caller says is verified', async () => {
    const { urls } = captureUrl();
    // The caller read this off a verified row; this layer cannot check it and
    // does not try. Without it the tenant's `From` is signed by the platform's
    // key and fails alignment for their own domain.
    await provider().send({
      ...message('Juniper Row <hello@a-tenants-own-domain.example>'),
      senderDomain: 'a-tenants-own-domain.example',
    });
    expect(urls[0]).toContain('/v3/a-tenants-own-domain.example/messages');
  });

  it('is not defeated by casing or stray whitespace', async () => {
    const { urls } = captureUrl();
    await provider().send({
      ...message('Shop <hello@A-Tenants-Own-Domain.example>'),
      senderDomain: '  A-Tenants-Own-Domain.Example ',
    });
    expect(urls[0]).toContain('/v3/a-tenants-own-domain.example/messages');
  });

  it('falls back to the platform default when the caller names none', async () => {
    const { urls } = captureUrl();
    await provider().send(message('Shop <hello@a-tenants-own-domain.example>'));
    expect(urls[0]).toContain(`/v3/${DEFAULT_DOMAIN}/messages`);
  });
});
