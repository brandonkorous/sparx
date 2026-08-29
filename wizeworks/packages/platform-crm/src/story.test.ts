// The signups board reported no industry for any tenant, ever (issue 320).
//
// `readStory` looked only at `settings.onboarding.story`, which the CONSOLE's
// story composer writes. Piggles tenants onboard through the account app and
// sparx tenants through the industry starter, and both of those record the
// trade at `settings.industry` instead — so the field the board segments on was
// null for all sixteen tenants in the test database while sitting one key away
// in the same JSON blob.
//
// The shapes below are the real ones, read off tenant rows.

import { describe, expect, it } from 'vitest';

import { readStory } from './mirror';

/** Juniper Row, after Piggles' account-app onboarding + the apparel starter. */
const PIGGLES_TENANT = {
  rail: { apps: ['home', 'site', 'sell'] },
  modules: { commerce: { enabled: true } },
  piggles: { railGroups: ['web', 'sell', 'people'], onboardedAt: '2026-08-23T10:50:01.799Z' },
  industry: 'apparel',
};

/** A tenant that went through the console's story composer. */
const COMPOSER_TENANT = {
  industry: 'food',
  onboarding: {
    story: {
      industry: 'bakery',
      audience: 'people nearby',
      text: 'A neighbourhood bakery that opens at six.',
      modules: ['commerce', 'builder'],
      composedAt: '2026-08-01T09:00:00.000Z',
    },
  },
};

describe('readStory', () => {
  it('takes the trade from settings.industry when there is no composer story', () => {
    expect(readStory(PIGGLES_TENANT).industry).toBe('apparel');
  });

  it('leaves the questions that onboarding never asked null', () => {
    const story = readStory(PIGGLES_TENANT);
    expect(story.audience).toBeNull();
    expect(story.text).toBeNull();
    expect(story.composedAt).toBeNull();
    // Already carried, separately and honestly, as railGroups.
    expect(story.impliedModules).toEqual([]);
  });

  it('prefers the composer story over the starter trade when both exist', () => {
    // The composer is the owner in their own words; the starter key is a slug
    // chosen from a list. Where they disagree the sentence wins.
    expect(readStory(COMPOSER_TENANT).industry).toBe('bakery');
  });

  it('still reads every composer field', () => {
    const story = readStory(COMPOSER_TENANT);
    expect(story.audience).toBe('people nearby');
    expect(story.text).toBe('A neighbourhood bakery that opens at six.');
    expect(story.impliedModules).toEqual(['commerce', 'builder']);
    expect(story.composedAt).toBe('2026-08-01T09:00:00.000Z');
  });

  it('reports null rather than throwing on anything malformed', () => {
    // A mirror that throws on one bad blob stops recording signups entirely.
    for (const settings of [
      null,
      undefined,
      'not an object',
      42,
      {},
      { industry: '' },
      { industry: '   ' },
      { industry: 42 },
      { industry: null },
      { onboarding: null },
      { onboarding: { story: 'a string' } },
      { onboarding: { story: { industry: 7 } } },
    ]) {
      expect(readStory(settings).industry).toBeNull();
    }
  });

  it('trims a trade that arrived with whitespace', () => {
    expect(readStory({ industry: '  florist  ' }).industry).toBe('florist');
  });
});
