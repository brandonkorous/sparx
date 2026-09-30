// A VERIFIED DEFAULT ADDRESS IS NOT THE SAME THING AS THE FROM LINE.
//
// The domain pane said "This site sends its email from this address by default"
// on the strength of `defaultSendingDomainId`, which nothing on the send path
// reads. The From header comes from the From address in Email settings, so the
// pane now checks the server's resolved header against the domain.

import { describe, expect, it } from 'vitest';

import { sendsFromDomain } from './domains-data';

describe('sendsFromDomain', () => {
  it('matches a named header at this domain', () => {
    expect(sendsFromDomain('Harbor Books <hello@harborbooks.com>', 'harborbooks.com')).toBe(true);
  });

  it('matches a bare address, and ignores case', () => {
    expect(sendsFromDomain('Hello@HarborBooks.com', 'harborbooks.com')).toBe(true);
  });

  it('does not match the shared platform address', () => {
    expect(sendsFromDomain('Harbor Books <harbor-books@sparx.email>', 'harborbooks.com')).toBe(
      false
    );
  });

  it('does not match a look-alike domain that merely ends the same way', () => {
    // `notharborbooks.com` ends in `harborbooks.com`; only `@harborbooks.com` counts.
    expect(sendsFromDomain('Them <a@notharborbooks.com>', 'harborbooks.com')).toBe(false);
  });

  it('reads the address, not a name that happens to contain the domain', () => {
    expect(sendsFromDomain('x@harborbooks.com <shop@sparx.email>', 'harborbooks.com')).toBe(false);
  });
});
