// A time zone is said in words on Places (persona issue 286): the list printed
// "America/Denver, from your business". Piggles already said the city.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./locations-list.tsx', import.meta.url)),
  'utf8'
);

describe('the Places time zone column', () => {
  it('does not print the raw zone name', () => {
    expect(source).not.toMatch(/\{location\.timezone \?\?/);
    expect(source).not.toContain('`${businessZone}, from your business`');
  });

  it('says the zone in words', () => {
    expect(source).toContain('zoneWords(');
  });
});

describe('the place and resource forms', () => {
  // Both listed eleven raw zone names ("America/Denver"), with no Arizona, while
  // Response times and Chat used the city picker (issue 286).
  const read = (file: string) =>
    readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

  it.each(['./location-detail.tsx', './resource-detail.tsx'])('%s uses the city picker', (file) => {
    const text = read(file);
    expect(text).toContain('<TimezoneSelect');
    expect(text).not.toMatch(/TIMEZONE_OPTIONS|const TIMEZONES/);
  });
});
