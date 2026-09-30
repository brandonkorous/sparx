import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import {
  SUSPENDED_BODY,
  SUSPENDED_HEADING,
  SUSPENDED_METADATA,
  SUSPENDED_TITLE,
  suspendedLlmsTxt,
  suspendedPage,
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
    // The page was the one left out, and it is the only one of the four that
    // ever becomes a search result (issue 844).
    ['the page', suspendedPage],
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

describe('the page says the same thing as the files beside it', () => {
  it('is served as a document, not as plain text', () => {
    expect(suspendedPage().headers.get('content-type')).toContain('text/html');
  });

  it('carries the two sentences and nothing about a bill', async () => {
    const body = await suspendedPage().text();
    expect(body).toContain(SUSPENDED_HEADING);
    expect(body).toContain(SUSPENDED_BODY);
    expect(body).toContain(`<title>${SUSPENDED_TITLE}</title>`);
  });

  it('never names the business, the platform, or the reason', async () => {
    // A visitor must not learn from a shop's own website that it has a billing
    // problem, and a platform-branded takeover of a dark site would advertise
    // exactly that.
    const body = (await suspendedPage().text()).toLowerCase();
    for (const word of ['sparx', 'piggles', 'billing', 'subscription', 'payment', 'invoice']) {
      expect(body).not.toContain(word);
    }
  });

  it('depends on nothing the edge does not have', async () => {
    // This is returned from the proxy, where the app's Tailwind bundle, the font
    // package and the tenant's theme all do not exist. A stylesheet link here
    // would render the overlay unstyled in production and correctly in every
    // test that only reads the words.
    const body = await suspendedPage().text();
    expect(body).not.toContain('<link');
    expect(body).not.toContain('--st-');
    expect(body).toContain('<style>');
  });
});

describe('the two renderers of one screen', () => {
  it('the React backstop reads its words from here rather than repeating them', () => {
    // A dark page is drawn twice: the proxy's 503 above, and the root layout's
    // component for anything the proxy could not identify. Two copies of one
    // sentence is how one of them keeps the old words after a copy edit.
    const component = readFileSync(
      new URL('../components/site-suspended.tsx', import.meta.url),
      'utf8'
    );
    expect(component).toContain('SUSPENDED_HEADING');
    expect(component).toContain('SUSPENDED_BODY');
    expect(component).not.toContain('Back soon');
  });
});
