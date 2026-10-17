// A zero is not bad news (persona issue 276): Not selling showed "0" in danger red
// and "$0.00" tied up in warning amber, over "Everything is moving".

import { describe, expect, it } from 'vitest';

import { badNewsTone } from './bad-news-tone';

describe('the color of a figure that is bad news when it is high', () => {
  it('is plain at zero', () => {
    expect(badNewsTone(0, 'text-danger')).toBeUndefined();
  });

  it('carries its tone once there is something', () => {
    expect(badNewsTone(3, 'text-danger')).toBe('text-danger');
    expect(badNewsTone(150_00, 'text-warning')).toBe('text-warning');
  });
});
