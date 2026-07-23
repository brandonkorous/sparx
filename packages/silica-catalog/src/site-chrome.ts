// The sparx-native silica site chrome (docs/118 Stage 6) — the branded navbar +
// footer the starter frame composes around the Outlet.
//
// Authored from silica PRIMITIVES (not silica's shipped marketing `navbar`/`footer`
// blocks, which hardcode "SilicaUI" demo branding), so the starter carries the
// TENANT'S identity: the wordmark + footer name + copyright BIND to
// `site.identity.name`, resolved per-tenant by the storefront host's `site.*` root
// (`buildSilicaHost({ site })`). Copy is neutral and jargon-free — a business owner
// with no store yet, no vertical assumed (content and/or commerce, per the platform
// framing) — so it reads as a real starting point, not a filled-in demo.
//
// AUTHORING CONTRACT (builder-contract §5): every factory returns a FRESH, id-free
// `Node`; every class is a LITERAL string (the Tailwind `@source` harness safelists
// them); layout uses core utilities (flex/grid/gap), not a component class that may
// not exist in the plugin.

import { bind, el, type Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';

/** A nav link — a plain anchor to an in-site route. `extra` appends layout classes
 *  for the phone menu, where each link is a full-width row rather than an inline
 *  item; the link is rebuilt rather than patched because `Node` is a union and not
 *  every member carries a `class`. */
function navLink(label: string, href: string, extra = ''): Node {
  return el(
    'a',
    `text-sm font-medium text-base-content transition-colors hover:text-base-content${
      extra ? ` ${extra}` : ''
    }`,
    {
      attrs: { href },
      text: label,
    }
  );
}

/** The site's primary destinations, in one place so the desktop row and the phone
 *  menu can never drift into offering different links.
 *
 *  Takes the OPTIONS OBJECT rather than positional booleans: with three module flags
 *  of the same type, a call site that transposes two arguments type-checks perfectly
 *  and silently ships the wrong nav. */
function navDestinations(opts: SiteChromeOptions): [string, string][] {
  const { commerceEnabled = true, schedulingEnabled = false, cmsEnabled = false } = opts;
  const link = (label: string, href: string): [string, string][] => [[label, href]];
  return [
    ...(commerceEnabled ? link('Shop', '/shop') : []),
    ...(schedulingEnabled ? link('Book', '/book') : []),
    // The blog index. Gated on CMS for the same reason Shop is gated on Commerce: a
    // link into a section with nothing behind it is worse than no link.
    ...(cmsEnabled ? link('Journal', '/blog') : []),
    ['About', '/about'],
    ['Contact', '/contact'],
  ];
}

/** A footer link column: a heading + a stack of links. */
function footerColumn(title: string, links: [string, string][]): Node {
  return el('div', 'flex flex-col gap-3', {
    children: [
      el('h3', 'text-sm font-semibold text-base-content', { text: title }),
      ...links.map(([label, href]) =>
        el('a', 'text-sm text-base-content transition-colors hover:text-base-content', {
          attrs: { href },
          text: label,
        })
      ),
    ],
  });
}

export interface SiteChromeOptions {
  /** Whether to show Shop/Cart/Orders links — omit for a tenant with no Commerce
   *  module active, so the chrome never invites a visitor into a store that
   *  doesn't exist (content and/or commerce — never assumed). Defaults to `true`
   *  so existing callers (the MCP catalog block, tests) are unaffected. */
  commerceEnabled?: boolean;
  /** Whether to show the Book link + seed a `/book` page — on only for a tenant with
   *  the Scheduling module active. Defaults to `false` (opt-in, unlike Commerce's
   *  legacy unconditional Shop): a content/commerce tenant with no bookings never gets
   *  a Book link or an orphan booking page. */
  schedulingEnabled?: boolean;
  /** Whether to show the Journal link + seed a `/blog` index — on only for a tenant
   *  with the CMS module active. Defaults to `false`, matching Scheduling's opt-in.
   *
   *  This flag was MISSING while Commerce and Scheduling had one, which made a
   *  publisher-only tenant a second-class citizen in their own chrome: they could
   *  write posts, each post got a real detail page, and there was no index and no
   *  link to reach any of it. Content and/or commerce is the product's premise —
   *  the chrome has to mean it. */
  cmsEnabled?: boolean;
}

/** The site navbar: the tenant wordmark (bound to `site.identity.name`) on the
 *  left, primary links centered-right, and a single call-to-action. A `<nav>` on
 *  core flex utilities so it needs no component class. */
export function siteNavbar(opts: SiteChromeOptions = {}): Node {
  const destinations = navDestinations(opts);
  return el(
    'nav',
    'flex items-center justify-between gap-6 border-b border-base-300 bg-base-100 px-6 py-4',
    {
      attrs: { 'aria-label': 'Primary' },
      children: [
        // The brand mark — a LIVE host core, not a stamped lockup. The platform renders
        // the tenant's current logo + name here on every request, so uploading a logo in
        // Site settings shows up in the header with no builder trip, and every future
        // improvement to the mark reaches every tenant. A stamped node would freeze at
        // publish (see `HOST_KEYS.siteBrand`). Not pinned: the tenant owns its placement.
        hostCore(HOST_KEYS.siteBrand),
        el('div', 'flex items-center gap-3 sm:gap-6', {
          children: [
            el('div', 'hidden items-center gap-6 sm:flex', {
              children: destinations.map(([label, href]) => navLink(label, href)),
            }),
            // The SAME links for phones. Without this the header collapsed to a
            // wordmark and one button below `sm`, so a visitor on a phone could not
            // reach any page — the links were hidden with nothing on the other side
            // of the breakpoint. It shipped in the starter chrome, so every tenant
            // site built on it had no mobile navigation at all.
            //
            // A raw <details>/<summary> rather than a scripted menu: it opens with
            // zero JS on a published page, so the one piece of chrome a visitor
            // cannot do without never depends on hydration.
            //
            // Raw elements rather than the `Collapse` component, which was the first
            // attempt: Collapse is an ACCORDION PANEL. Its `.details` class paints a
            // bordered card, and `.details-content` sets an explicit `display`, which
            // overrides the browser's own hiding of a closed <details> — so the menu
            // rendered permanently open, spilling every link into the header. Styling
            // meant for a content disclosure does not transfer to a nav menu.
            //
            // `list-none` on the summary drops the default disclosure triangle.
            el('details', 'relative sm:hidden', {
              children: [
                el(
                  'summary',
                  'cursor-pointer list-none rounded-btn px-3 py-2 text-sm font-medium text-base-content',
                  { text: 'Menu' }
                ),
                // NO display utility on this element. A closed <details> hides its
                // non-summary children through a UA-stylesheet `display: none`, which
                // any author `display` beats on specificity — putting `flex` here made
                // the menu render permanently open. The flex column lives one level in,
                // where it cannot outrank the browser.
                el(
                  'div',
                  'absolute right-0 z-30 mt-2 w-48 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg',
                  {
                    children: [
                      el('div', 'flex flex-col gap-1', {
                        children: [
                          ...destinations.map(([label, href]) =>
                            navLink(label, href, 'rounded-btn px-3 py-2 hover:bg-base-200')
                          ),
                          // Sign-in reaches the phone menu too, so a shopper on a phone can
                          // get to their account (the desktop link is hidden below `sm`).
                          navLink(
                            'Sign in',
                            '/account/login',
                            'rounded-btn px-3 py-2 hover:bg-base-200'
                          ),
                        ],
                      }),
                    ],
                  }
                ),
              ],
            }),
            // A light/dark switch — a host core, so it mounts the real cookie-backed
            // control and AUTO-HIDES unless the tenant turns on the `toggle` appearance
            // policy. Costs nothing on a single-theme site (renders nothing); lights up
            // the moment both palettes are offered.
            hostCore(HOST_KEYS.siteThemeToggle),
            // Account entry point — the shopper sign-in / create-account page. Every site
            // has it (Layer-2 shopper auth); a ghost link so it sits quietly beside the CTA.
            el('a', 'btn btn-ghost btn-sm', {
              attrs: { href: '/account/login' },
              text: 'Sign in',
            }),
            // A real link, not a <button>. This was `atom('Button', …)`, which lowers
            // to a `<button type="button">` with no handler — the site's most
            // prominent call to action did nothing at all when clicked.
            el('a', 'btn btn-primary btn-sm', {
              attrs: { href: '/contact' },
              text: 'Get in touch',
            }),
          ],
        }),
      ],
    }
  );
}

/** The site footer: a brand column (name bound) + link columns + a bound
 *  copyright line. Neutral, industry-agnostic labels. */
export function siteFooter(opts: SiteChromeOptions = {}): Node {
  const { commerceEnabled = true } = opts;
  return el('footer', 'border-t border-base-300 bg-base-200 px-6 py-12', {
    children: [
      el(
        'div',
        commerceEnabled
          ? 'mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4'
          : 'mx-auto grid max-w-6xl gap-10 sm:grid-cols-3',
        {
          children: [
            el('div', 'flex flex-col gap-3', {
              children: [
                bind(
                  el('span', 'text-lg font-bold text-base-content', { text: 'Your site' }),
                  'site.identity.name'
                ),
                el('p', 'max-w-xs text-sm text-base-content', {
                  text: commerceEnabled
                    ? 'Everything you publish and sell, in one place.'
                    : 'Everything you publish, in one place.',
                }),
              ],
            }),
            // Same source as the navbar's two renderings, so header and footer can
            // never advertise different destinations. Search is appended footer-side
            // only — a utility destination, not something the header needs a slot for.
            footerColumn('Explore', [...navDestinations(opts), ['Search', '/search']]),
            ...(commerceEnabled
              ? [
                  footerColumn('Account', [
                    ['Sign in', '/account'],
                    ['Orders', '/account/orders'],
                    ['Cart', '/cart'],
                  ]),
                ]
              : []),
            // Legal — a LIVE host core, not authored links. This column used to be a
            // hardcoded `Privacy → /privacy-policy` + `Terms → /terms-of-service` pair,
            // which meant every site built on this starter shipped two footer links to
            // pages that don't exist until the tenant creates them in Content → Legal
            // pages. The core renders the documents they have ACTUALLY published, and
            // renders nothing at all until there are any (see `HOST_KEYS.siteLegalLinks`).
            hostCore(HOST_KEYS.siteLegalLinks),
          ],
        }
      ),
      el('div', 'mx-auto mt-10 max-w-6xl border-t border-base-300 pt-6', {
        children: [
          bind(el('p', 'text-sm text-base-content', { text: 'Your site' }), 'site.identity.name'),
        ],
      }),
    ],
  });
}
