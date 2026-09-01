// One condition, two consumers.
//
// The point of this module is that the server config which REGISTERS a provider
// and the screen which OFFERS a button for it ask the same question. These pin
// the question itself; nothing else can, because the two consumers live in
// different packages and neither can see the other's copy.

import { describe, expect, it } from 'vitest';
import { configuredSocialProviders, socialProviderConfigured } from './social-providers';

const BOTH = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };

describe('configuredSocialProviders', () => {
  it('offers a provider only when EVERY credential it needs is present', () => {
    expect(configuredSocialProviders(BOTH)).toEqual(['google']);
    // Half-configured is the case that matters: it is what a deployment looks
    // like mid-rollout, and it used to render a button that could only error.
    expect(configuredSocialProviders({ GOOGLE_CLIENT_ID: 'id' })).toEqual([]);
    expect(configuredSocialProviders({ GOOGLE_CLIENT_SECRET: 'secret' })).toEqual([]);
    expect(configuredSocialProviders({})).toEqual([]);
  });

  it('treats an empty string as absent, because that is what an unset env var becomes', () => {
    expect(configuredSocialProviders({ ...BOTH, GOOGLE_CLIENT_SECRET: '' })).toEqual([]);
  });

  it('reads the environment it is given, not a snapshot taken at import', () => {
    // A server render asks per request; a module-level snapshot would freeze
    // whatever the environment was when the bundle first loaded.
    expect(configuredSocialProviders({})).toEqual([]);
    expect(configuredSocialProviders(BOTH)).toEqual(['google']);
  });
});

describe('socialProviderConfigured', () => {
  it('answers for one provider', () => {
    expect(socialProviderConfigured('google', BOTH)).toBe(true);
    expect(socialProviderConfigured('google', {})).toBe(false);
  });
});
