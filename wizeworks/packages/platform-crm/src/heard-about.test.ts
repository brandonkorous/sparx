// The owner's own answer to "where did you hear about us", read off the shape the
// onboarding writes (`settings.acquisition.heardAbout`).

import { describe, expect, it } from 'vitest';

import { readHeardAbout } from './mirror';

describe('readHeardAbout', () => {
  it('reads the answer onboarding saved', () => {
    expect(readHeardAbout({ acquisition: { heardAbout: 'tv-event' } })).toBe('tv-event');
  });

  it('is null when the question was skipped or never asked', () => {
    expect(readHeardAbout({ acquisition: { heardAbout: '' } })).toBeNull();
    expect(readHeardAbout({ acquisition: {} })).toBeNull();
    expect(readHeardAbout({})).toBeNull();
    expect(readHeardAbout(null)).toBeNull();
  });

  it('ignores a value that is not a string', () => {
    expect(readHeardAbout({ acquisition: { heardAbout: 7 } })).toBeNull();
  });
});
