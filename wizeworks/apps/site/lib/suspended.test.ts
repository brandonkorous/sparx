import { describe, expect, it } from 'vitest';

import {
  SUSPENDED_METADATA,
  suspendedLlmsTxt,
  suspendedRobotsTxt,
  suspendedSitemapXml,
} from './suspended';

/**
 * A dark site is a shop that is coming back, so every answer it gives a machine
 * has to mean "ask again later". There is one status that means that.
 *
 * These are worth having as tests rather than as a comment because the wrong
 * answers here are all PLAUSIBLE ones — 404 for a sitemap that is not being
 * served, `Disallow: /` for a site that should not be crawled, `noindex` for a
 * page that should not be listed. Each reads as caution and each one costs the
 * business its listings. Nothing renders differently, nothing throws, and the
 * bill is paid weeks before anybody notices the traffic did not come back.
 */
describe('a dark site asks a crawler to come back later', () => {
  const answers = [
    ['robots.txt', suspendedRobotsTxt],
    ['sitemap.xml', suspendedSitemapXml],
    ['llms.txt', suspendedLlmsTxt],
  ] as const;

  it.each(answers)('%s answers 503, not 404 and not 200', (_name, make) => {
    // 404 says "there is nothing at this address" and gets a sitemap dropped;
    // 200 says the body is the truth about the shop. Only 503 says "later".
    expect(make().status).toBe(503);
  });

  it.each(answers)('%s tells the crawler when to try again', (_name, make) => {
    const retry = make().headers.get('retry-after');
    expect(retry).not.toBeNull();
    expect(Number(retry)).toBeGreaterThan(0);
  });

  it.each(answers)('%s is never cached', (_name, make) => {
    // Suspension lifts the moment a payment goes through. Anything that keeps a
    // copy keeps the shop dark after the business has paid to be visible.
    expect(make().headers.get('cache-control')).toBe('no-store');
  });

  it('robots.txt leaves no rule behind for the crawler to hold', () => {
    // `Disallow: /` is a rule a crawler stores and obeys until it re-reads the
    // file, so it can outlast the outage — and while it is held, the crawler
    // never fetches the pages that carry any other guard. This is the defect
    // stated as text: if this body ever contains a disallow again, the page
    // guards below it are unreachable by construction.
    return suspendedRobotsTxt()
      .text()
      .then((body) => {
        expect(body.toLowerCase()).not.toContain('disallow');
      });
  });
});

describe('a dark page does not ask to be deleted', () => {
  it('sends no robots directive at all', () => {
    // The absence is the assertion. `noindex` is the instruction to REMOVE a
    // URL from search: it is the one outcome a temporary outage must not cause,
    // and it is the first thing anybody adds back here while trying to help.
    expect(SUSPENDED_METADATA.robots).toBeUndefined();
  });

  it('still keeps the shop name off a blank page', () => {
    // Neutral, and not the tenant's real title: the overlay must not sit in a
    // search result under the business's own name and description.
    expect(SUSPENDED_METADATA.title).toBe('Temporarily unavailable');
  });
});
