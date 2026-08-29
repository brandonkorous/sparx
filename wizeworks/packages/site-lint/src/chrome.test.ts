// A site whose customers cannot reach their account from anywhere in the chrome.
//
// Driven through `lintSite` rather than `checkChrome` directly, because the two things
// most likely to be got wrong here are not inside the rule: whether it stays silent when
// the caller never said the site has accounts, and whether the one frame produces one
// row rather than one per page. Both are answered by the whole engine or not at all.

import { describe, expect, it } from 'vitest';
import { atom, el } from '@wizeworks/silicaui-html';
import type { Node } from '@wizeworks/silicaui-html';
import { HOST_KEYS, hostCore } from '@wizeworks/silica-catalog';

import { lintSite } from './lint';
import type { LintablePage, SiteLintInput } from './types';

const outlet: Node = { kind: 'outlet' };

/** A frame in the real shape: a `<nav>` holding whatever is being tested, the page
 *  outlet, and a `<footer>`. */
const frame = (...bar: Node[]) => ({
  root: el('div', 'site', {
    children: [el('nav', 'navbar', { children: bar }), outlet, el('footer', 'footer')],
  }),
});

const page = (name: string, slug: string): LintablePage => ({
  id: `page-${slug || 'home'}`,
  name,
  slug,
  root: el('main', '', { children: [el('h1', '', { text: name })] }),
});

const PAGES = [page('Home', '/'), page('About', '/about'), page('Shop', '/shop')];

const sells = { customerAccounts: true };

function accountFindings(input: Partial<SiteLintInput>) {
  return lintSite({ pages: PAGES, ...input }).findings.filter(
    (f) => f.rule === 'chrome-no-account-link'
  );
}

describe('no way into the account area', () => {
  it('tells an owner whose chrome has nothing at all', () => {
    // The 24 shipped designs of issue 313, and the six live sites built from one.
    const findings = accountFindings({
      frame: frame(el('span', '', { text: 'Row & Co' })),
      capabilities: sells,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.location.scope).toBe('frame');
  });

  it('says it ONCE for the whole site, naming every page it costs a visitor on', () => {
    // One header, one edit. Three rows would read as three problems and train an owner
    // to skim the list — see `finding.ts`.
    const [finding] = accountFindings({
      frame: frame(el('span', '', { text: 'Row & Co' })),
      capabilities: sells,
    });
    expect(finding?.location.seenOn).toEqual(['Home', 'About', 'Shop']);
  });

  it('says nothing when the caller never said the site has accounts', () => {
    // A portfolio, a menu, a parish newsletter. `undefined` is "nobody looked", and a
    // check that guesses here nags every content site on the platform.
    expect(accountFindings({ frame: frame(el('span', '', { text: 'Row & Co' })) })).toEqual([]);
  });

  it('says nothing when the caller looked and there are no accounts', () => {
    expect(
      accountFindings({
        frame: frame(el('span', '', { text: 'Row & Co' })),
        capabilities: { customerAccounts: false },
      })
    ).toEqual([]);
  });

  it('accepts the live account core', () => {
    expect(
      accountFindings({ frame: frame(hostCore(HOST_KEYS.siteAccountLink)), capabilities: sells })
    ).toEqual([]);
  });

  it('accepts a stamped sign-in link, which is a different complaint', () => {
    // Issue 291's defect, not this one: it works, it just greets a signed-in customer as
    // a stranger. `liveChromeGaps` speaks for it, and two rows for one edit is worse
    // than one.
    expect(
      accountFindings({
        frame: frame(el('a', '', { attrs: { href: '/account/login' }, text: 'Sign in' })),
        capabilities: sells,
      })
    ).toEqual([]);
  });

  it('accepts an author who wired their own button deeper into the account area', () => {
    expect(
      accountFindings({
        frame: frame(atom('Button', 'btn', { href: '/account/orders', label: 'My orders' })),
        capabilities: sells,
      })
    ).toEqual([]);
  });

  it('accepts a link in the footer rather than the header', () => {
    // The rule asks whether a customer can get there, never which part of the chrome
    // the author put it in.
    const root = el('div', 'site', {
      children: [
        el('nav', 'navbar', { children: [el('span', '', { text: 'Row & Co' })] }),
        outlet,
        el('footer', 'footer', {
          children: [el('a', '', { attrs: { href: '/account' }, text: 'Your account' })],
        }),
      ],
    });
    expect(accountFindings({ frame: { root }, capabilities: sells })).toEqual([]);
  });

  it('is not satisfied by an account link on ONE page instead of the chrome', () => {
    // A visitor who lands on any other page is still stranded, so a page-body link is
    // not a route out of this finding.
    const withLink: LintablePage = {
      ...page('Home', '/'),
      root: el('main', '', {
        children: [el('a', '', { attrs: { href: '/account' }, text: 'Sign in' })],
      }),
    };
    const findings = lintSite({
      pages: [withLink, page('About', '/about')],
      frame: frame(el('span', '', { text: 'Row & Co' })),
      capabilities: sells,
    }).findings.filter((f) => f.rule === 'chrome-no-account-link');
    expect(findings).toHaveLength(1);
  });

  it('says nothing about a site with no shared chrome at all', () => {
    // There is no header to be missing a link from, and the fix it would name does not
    // exist yet.
    expect(accountFindings({ capabilities: sells })).toEqual([]);
  });

  it('does not count a link to somebody else’s account page', () => {
    expect(
      accountFindings({
        frame: frame(
          el('a', '', { attrs: { href: 'https://supplier.example.com/account' }, text: 'Portal' })
        ),
        capabilities: sells,
      })
    ).toHaveLength(1);
  });

  it('speaks to the owner about their customers, not about the tree', () => {
    const [finding] = accountFindings({
      frame: frame(el('span', '', { text: 'Row & Co' })),
      capabilities: sells,
    });
    expect(finding?.title).toContain('account');
    expect(`${finding?.title} ${finding?.detail}`).not.toContain('site.account-link');
    expect(finding?.detail).toContain('return');
  });

  it('never moves the status to a failure', () => {
    // Advisory, like everything else here: a missing control is a warning, and nothing
    // in this package decides whether a publish may proceed.
    const report = lintSite({
      pages: PAGES,
      frame: frame(el('span', '', { text: 'Row & Co' })),
      capabilities: sells,
    });
    expect(report.status).toBe('warn');
  });
});
