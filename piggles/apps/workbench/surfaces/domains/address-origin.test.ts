import { describe, expect, it } from 'vitest';
import { addressOrigin } from './address-origin';

const say = (host: string, createdAt: string) => addressOrigin(host, createdAt, 'Piggles');

describe('where a free address came from', () => {
  it('says she chose it, and where, once signup asked her to', () => {
    expect(say('workshops-co.piggles.site', '2026-10-06T22:10:00Z')).toBe(
      'You chose this address when you signed up, in the Your web address box on the last step.'
    );
  });

  it('says a site address was chosen when the site was added', () => {
    expect(say('archive.juniper-row.piggles.site', '2026-09-30T10:00:00Z')).toMatch(
      /^You chose this site's address when you added the site, in its Web address box\. The first part, archive,/
    );
  });

  it('does not claim she chose an address made before the box existed', () => {
    expect(say('juniper-row.piggles.site', '2026-08-23T18:00:00Z')).toBe(
      "Piggles made this address from your business's name when you signed up."
    );
    expect(say('archive.juniper-row.piggles.site', '2026-08-20T10:00:00Z')).toMatch(
      /^Piggles gave this site its address when it was added\./
    );
  });

  it('owns up to a made-up name, whenever it was made', () => {
    expect(say('quiet-haven-3783.piggles.site', '2026-08-18T09:00:00Z')).toBe(
      'Piggles made this address up when you signed up, before it asked businesses to choose their own.'
    );
  });
});
