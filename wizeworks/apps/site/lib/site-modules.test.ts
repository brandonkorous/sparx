// What a site has switched off, and what that switches off.
//
// The screen that writes this says "Switch off anything this site has no use
// for." Before this table existed the sentence was false in every case: the
// field reached the storefront on every page load and was dropped at the
// boundary. These tests state which paths each switch owns, because a gate that
// silently stops matching looks exactly like a site that was never scoped.

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const {
  SCOPEABLE_MODULES,
  moduleForKey,
  moduleForPath,
  requireSiteModule,
  requireSiteModuleForPath,
  siteShowsLink,
  siteShowsModule,
  siteShowsPage,
  pruneHiddenLinks,
} = await import('./site-modules');

const site = (...off: string[]) => ({ disabledModules: off });

describe('which module owns a path', () => {
  it('gives the shop to Selling', () => {
    for (const path of [
      '/cart',
      '/checkout',
      '/checkout/save-card',
      '/products',
      '/products/celeste-cuff',
      '/category',
      '/category/jewelry',
      '/collections/new-in',
      '/search',
    ]) {
      expect(moduleForPath(path), path).toBe('commerce');
    }
  });

  it('gives the journal to Content', () => {
    expect(moduleForPath('/blog')).toBe('cms');
    expect(moduleForPath('/blog/the-case-for-fewer-clothes')).toBe('cms');
  });

  it('splits the account area by what each page is FOR', () => {
    expect(moduleForPath('/account/orders')).toBe('commerce');
    expect(moduleForPath('/account/returns/r-1')).toBe('commerce');
    expect(moduleForPath('/account/wishlist')).toBe('commerce');
    expect(moduleForPath('/account/requests')).toBe('crm');
    expect(moduleForPath('/account/estimates')).toBe('crm');
  });

  it('matches the LONGEST prefix, so wholesale beats selling', () => {
    // `/account/b2b` sits under nothing else, but `/account/orders` is a
    // commerce prefix of similar shape. Order of declaration must not decide it.
    expect(moduleForPath('/account/b2b')).toBe('b2b');
    expect(moduleForPath('/account/b2b/acct-1/invoices')).toBe('b2b');
  });

  it('owns nothing outside a segment boundary', () => {
    // The day a shop writes a page about maps, /cart must not take it down.
    expect(moduleForPath('/cartography')).toBeNull();
    expect(moduleForPath('/searchlight')).toBeNull();
    expect(moduleForPath('/blogger')).toBeNull();
  });

  it('leaves alone what no switch owns', () => {
    for (const path of ['/', '/about', '/bookshop', '/meeting-notes']) {
      expect(moduleForPath(path), path).toBeNull();
    }
  });

  it('gives the booking pages to Bookings, and never a customer own booking link', () => {
    // Persona issue 944: a journal could switch its shop off and still say Book.
    for (const path of ['/book', '/book/fitting', '/meet/devi']) {
      expect(moduleForPath(path), path).toBe('scheduling');
    }
    expect(moduleForPath('/booking/abc')).toBeNull();
  });

  it('reads a path out of a full URL, and ignores query and hash', () => {
    expect(moduleForPath('https://juniper-row.example/products/x?ref=1')).toBe('commerce');
    expect(moduleForPath('/cart#summary')).toBe('commerce');
    expect(moduleForPath('/cart/')).toBe('commerce');
  });

  it('never claims somebody else’s site', () => {
    expect(moduleForPath('mailto:hello@example.test')).toBeNull();
    expect(moduleForPath('tel:+15550000')).toBeNull();
    expect(moduleForPath('#top')).toBeNull();
    expect(moduleForPath('')).toBeNull();
  });
});

describe('absent is not off', () => {
  it('shows everything when the field never arrived', () => {
    // An older api-rest sends no `disabledModules`. A shop must not go dark
    // because a field is missing. [[feedback_never_present_absence_as_measurement]]
    for (const slug of SCOPEABLE_MODULES) {
      expect(siteShowsModule({}, slug), slug).toBe(true);
      expect(siteShowsModule(null, slug), slug).toBe(true);
      expect(siteShowsModule(undefined, slug), slug).toBe(true);
    }
  });

  it('shows everything when nothing is switched off', () => {
    for (const slug of SCOPEABLE_MODULES) {
      expect(siteShowsModule(site(), slug), slug).toBe(true);
    }
  });

  it('hides only what was actually switched off', () => {
    const journal = site('commerce');
    expect(siteShowsModule(journal, 'commerce')).toBe(false);
    expect(siteShowsModule(journal, 'cms')).toBe(true);
    expect(siteShowsModule(journal, 'b2b')).toBe(true);
  });
});

describe('refusing a page', () => {
  it('lets the page through when the module is on', () => {
    expect(() => {
      requireSiteModule(site('cms'), 'commerce');
    }).not.toThrow();
  });

  it('refuses when the module is off', () => {
    expect(() => {
      requireSiteModule(site('commerce'), 'commerce');
    }).toThrow('NEXT_NOT_FOUND');
  });

  it('refuses by path for the routes that stand for several modules', () => {
    const journal = site('commerce');
    expect(() => {
      requireSiteModuleForPath(journal, '/account/orders');
    }).toThrow('NEXT_NOT_FOUND');
    expect(() => {
      requireSiteModuleForPath(journal, '/account/requests');
    }).not.toThrow();
    expect(() => {
      requireSiteModuleForPath(journal, '/account/profile');
    }).not.toThrow();
  });
});

describe('drawing a link', () => {
  it('drops a link to a page this site would refuse', () => {
    // A gated route with a live link to it is a 404 the business put in its own
    // header.
    const journal = site('commerce');
    expect(siteShowsLink(journal, '/cart')).toBe(false);
    expect(siteShowsLink(journal, '/products/celeste-cuff')).toBe(false);
  });

  it('keeps every link nothing owns', () => {
    const journal = site('commerce');
    expect(siteShowsLink(journal, '/')).toBe(true);
    expect(siteShowsLink(journal, '/about')).toBe(true);
    expect(siteShowsLink(journal, '/blog')).toBe(true);
    expect(siteShowsLink(journal, 'https://instagram.example/junipertow')).toBe(true);
    expect(siteShowsLink(journal, 'mailto:hello@example.test')).toBe(true);
  });
});

describe('which module owns a core or a record type', () => {
  it('reads the owner off the key, because the key already says it', () => {
    expect(moduleForKey('commerce.cart')).toBe('commerce');
    expect(moduleForKey('commerce.plp')).toBe('commerce');
    expect(moduleForKey('commerce.product')).toBe('commerce');
    expect(moduleForKey('cms.article-body')).toBe('cms');
  });

  it('owns nothing a site cannot switch off', () => {
    // The chrome's own cores.
    expect(moduleForKey('site.brand')).toBeNull();
    expect(moduleForKey('site.legal-links')).toBeNull();
  });

  it('takes the booking list block off with the Bookings switch', () => {
    expect(moduleForKey('scheduling.services')).toBe('scheduling');
  });

  it('never hides the sign-in panel', () => {
    // A visitor still signs in on a site that sells nothing: to ask a question,
    // to look at a quote, to keep an appointment.
    expect(moduleForKey('commerce.auth')).toBeNull();
  });
});

describe('whether an authored page belongs on this site', () => {
  const journal = site('commerce');

  it('keeps a page nothing owns', () => {
    expect(siteShowsPage(journal, { hostKeys: [] })).toBe(true);
    expect(siteShowsPage(journal, { hostKeys: ['site.brand'] })).toBe(true);
  });

  it('refuses the page a tenant called "Shop"', () => {
    // A product grid with a heading on it. Its reason to exist is switched off.
    expect(siteShowsPage(journal, { hostKeys: ['commerce.plp'] })).toBe(false);
  });

  it('refuses every product page by its record type', () => {
    expect(siteShowsPage(journal, { recordType: 'commerce.product' })).toBe(false);
    expect(siteShowsPage(journal, { recordType: 'commerce.collection' })).toBe(false);
  });

  it('keeps the journal’s own posts, which are a different switch', () => {
    expect(siteShowsPage(journal, { recordType: 'cms.post' })).toBe(true);
    expect(siteShowsPage(journal, { hostKeys: ['cms.article-body'] })).toBe(true);
  });

  it('keeps a sign-in page on a site that sells nothing', () => {
    expect(siteShowsPage(journal, { hostKeys: ['commerce.auth'] })).toBe(true);
  });

  it('refuses a mixed page if ANY core on it is switched off', () => {
    // Half a page is not a page. A shop grid beside an article body has one
    // reason to exist that this site has said no to.
    expect(siteShowsPage(journal, { hostKeys: ['cms.article-body', 'commerce.plp'] })).toBe(false);
  });

  it('keeps everything when nothing is switched off', () => {
    expect(siteShowsPage(site(), { recordType: 'commerce.product' })).toBe(true);
    expect(siteShowsPage({}, { hostKeys: ['commerce.plp'] })).toBe(true);
  });
});

describe('pruning the links out of a site’s own chrome', () => {
  const journal = site('commerce');
  const a = (href: string, text: string) => ({
    kind: 'element',
    tag: 'a',
    attrs: { href },
    children: [text],
  });
  const nav = (...children: unknown[]) => ({ kind: 'element', tag: 'nav', children });

  it('drops a link to a route this site refuses', () => {
    const before = nav(a('/cart', 'Cart'), a('/about', 'About'));
    const after = pruneHiddenLinks(before, journal) as { children: { attrs: { href: string } }[] };
    expect(after.children.map((c) => c.attrs.href)).toEqual(['/about']);
  });

  it('drops a link to one of this site’s OWN pages when told to', () => {
    // A page called "Shop" is a product grid; only api-rest can see that, so it
    // hands the path over.
    const before = nav(a('/shop', 'Shop'), a('/journal', 'Journal'));
    const after = pruneHiddenLinks(before, journal, ['/shop']) as {
      children: { attrs: { href: string } }[];
    };
    expect(after.children.map((c) => c.attrs.href)).toEqual(['/journal']);
  });

  it('leaves the whole tree alone when nothing is switched off', () => {
    const before = nav(a('/cart', 'Cart'), a('/shop', 'Shop'));
    expect(pruneHiddenLinks(before, site())).toBe(before);
  });

  it('takes the empty bullet with the link', () => {
    // A list item holding nothing is not a smaller nav, it is a broken one.
    const list = {
      kind: 'element',
      tag: 'ul',
      children: [
        { kind: 'element', tag: 'li', children: [a('/cart', 'Cart')] },
        { kind: 'element', tag: 'li', children: [a('/about', 'About')] },
      ],
    };
    const after = pruneHiddenLinks(list, journal) as { children: unknown[] };
    expect(after.children).toHaveLength(1);
  });

  it('keeps a list item that still has words in it', () => {
    const item = {
      kind: 'element',
      tag: 'li',
      children: ['Shop: ', a('/cart', 'Cart')],
    };
    const after = pruneHiddenLinks(item, journal) as { children: unknown[] };
    expect(after).not.toBeNull();
    expect(after.children).toEqual(['Shop: ']);
  });

  it('never touches a link whose address is decided at render time', () => {
    // A bound href is resolved by the host from live data. The authored value
    // says nothing about where it goes, so guessing would drop real links.
    const bound = {
      kind: 'element',
      tag: 'a',
      attrs: { href: '/cart' },
      data: { kind: 'value', ref: 'product.url' },
      children: ['Buy'],
    };
    expect(pruneHiddenLinks(bound, journal)).toBe(bound);
  });

  it('drops a component link too, not only a raw anchor', () => {
    const button = { kind: 'component', component: 'Button', props: { href: '/checkout' } };
    expect(pruneHiddenLinks(button, journal)).toBeNull();
  });

  it('passes a shape it does not recognize through whole', () => {
    const odd = { kind: 'outlet' };
    expect(pruneHiddenLinks(odd, journal)).toBe(odd);
    expect(pruneHiddenLinks('some text', journal)).toBe('some text');
  });
});

describe('pruning reaches all the way down', () => {
  // The bug this exists for: the walk returned the ORIGINAL node whenever no
  // DIRECT child had been dropped, which threw away every rebuilt descendant
  // with it. A header is four levels deep on a real site, so nothing at all was
  // ever pruned — while every test above, all one level deep, stayed green.
  it('drops a link buried four levels down', () => {
    const journal = { disabledModules: ['commerce'] };
    const deep = {
      kind: 'element',
      tag: 'header',
      children: [
        {
          kind: 'element',
          tag: 'div',
          children: [
            {
              kind: 'element',
              tag: 'nav',
              children: [
                { kind: 'element', tag: 'a', attrs: { href: '/cart' }, children: ['Cart'] },
                { kind: 'element', tag: 'a', attrs: { href: '/about' }, children: ['About'] },
              ],
            },
          ],
        },
      ],
    };
    const after = pruneHiddenLinks(deep, journal)!;
    expect(after).not.toBe(deep);
    const hrefs: string[] = [];
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object') return;
      const node = n as { attrs?: { href?: string }; children?: unknown[] };
      if (node.attrs?.href) hrefs.push(node.attrs.href);
      for (const c of node.children ?? []) walk(c);
    };
    walk(after);
    expect(hrefs).toEqual(['/about']);
  });

  it('still returns the very same tree when nothing anywhere is dropped', () => {
    const journal = { disabledModules: ['commerce'] };
    const deep = {
      kind: 'element',
      tag: 'header',
      children: [
        {
          kind: 'element',
          tag: 'nav',
          children: [{ kind: 'element', tag: 'a', attrs: { href: '/about' }, children: ['About'] }],
        },
      ],
    };
    expect(pruneHiddenLinks(deep, journal)).toBe(deep);
  });
});
