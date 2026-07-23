import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CryptoModule from './crypto.js';

// A valid 32-byte key expressed as 64 hex chars (matches the hex branch in crypto.ts).
const KEY = 'a'.repeat(64);

describe('social token crypto — configured', () => {
  let mod: typeof CryptoModule;
  beforeEach(async () => {
    vi.resetModules(); // drop the module-level cachedKey so env is re-read
    vi.stubEnv('SOCIAL_TOKEN_KEY', KEY);
    mod = await import('./crypto.js');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('reports configured', () => {
    expect(mod.isSocialTokenCryptoConfigured()).toBe(true);
  });

  it('round-trips a token and never stores it in the clear', () => {
    const enc = mod.encryptSocialToken('ya29.super-secret-token');
    expect(enc).not.toContain('secret');
    expect(mod.decryptSocialToken(enc)).toBe('ya29.super-secret-token');
  });

  it('uses a fresh IV each call (identical plaintext → different ciphertext)', () => {
    expect(mod.encryptSocialToken('x')).not.toBe(mod.encryptSocialToken('x'));
  });

  it('throws on a tampered bundle (GCM auth failure)', () => {
    const enc = mod.encryptSocialToken('token');
    const [iv, tag] = enc.split('.');
    const tampered = `${iv}.${tag}.${Buffer.from('evil-cipher').toString('base64')}`;
    expect(() => mod.decryptSocialToken(tampered)).toThrow();
  });

  it('throws on a malformed bundle', () => {
    expect(() => mod.decryptSocialToken('not-a-real-bundle')).toThrow(/malformed/i);
  });
});

describe('social token crypto — unconfigured', () => {
  let mod: typeof CryptoModule;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('SOCIAL_TOKEN_KEY', '');
    mod = await import('./crypto.js');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('reports not configured', () => {
    expect(mod.isSocialTokenCryptoConfigured()).toBe(false);
  });

  it('throws when asked to encrypt without a key', () => {
    expect(() => mod.encryptSocialToken('token')).toThrow(/not configured/i);
  });
});
