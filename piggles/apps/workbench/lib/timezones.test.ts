// sparx persona issue 027: "Search for your city" found nothing for Salt Lake City.
import { describe, expect, it } from 'vitest';
import { timezoneOptions } from './timezones';

describe('timezoneOptions', () => {
  const zones = timezoneOptions();

  it('finds a big city that shares another city’s zone', () => {
    const hit = zones.find((zone) => zone.label.startsWith('Salt Lake City'));
    expect(hit?.value).toBe('America/Denver');
  });

  it('finds the real entry first when looked up by stored zone', () => {
    expect(zones.find((zone) => zone.value === 'America/Denver')?.label).toMatch(/^Denver/);
  });
});
