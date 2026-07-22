// The silica-native starter Site (docs/118 Stage 4 — the re-seed, not a backfill).
//
// A fresh tenant's site as a silica `Site`: a shared `Frame` (branded nav ⊕ Outlet
// ⊕ footer wrapping every page) + a small set of `Page`s. Both the chrome and the
// page copy are sparx-authored from silica primitives — NOT silica's shipped
// marketing blocks, which hardcode "SilicaUI" demo branding and vertical-specific
// filler. The copy is neutral and jargon-free (a business owner with no store yet,
// no industry assumed — content and/or commerce), so the starter reads as a real
// starting point every tenant can edit, not someone else's demo.
//
// Every tree is fully STAMPED (ids present): a `Site`'s pages + frame are live,
// editable trees, so the builder's selection, React keys, and dnd-kit sortable ids
// all have the globally-unique ids they require the moment the site loads.
// `stampTree` deep-clones each root before minting, so reusing a factory is safe.

import {
  el,
  makePage,
  outlet,
  pageBody,
  stampTree,
  THEME_PRESETS,
  type Frame,
  type Node,
  type Page,
  type Site,
  type Theme,
} from '@wizeworks/silicaui-html';

import { blogIndexPage } from './cms';
import { featuredProducts, productGrid, shopHeader } from './commerce';
import { HOST_KEYS, functionalShell, hostCore } from './host-nodes';
import { siteFooter, siteNavbar, type SiteChromeOptions } from './site-chrome';

// ── Page content (sparx-authored, neutral copy) ──────────────────────────────

/** A centered text hero — no image (so no broken-placeholder), neutral copy that
 *  fits a publisher, a shop, or both. The owner edits the words in place. A
 *  Commerce-less tenant gets no "Browse the shop" CTA (there's no `/shop` page
 *  to send visitors to — see `starterPages`). */
function hero(commerceEnabled: boolean): Node {
  return el('section', 'bg-base-100 px-6 py-20 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content sm:text-5xl', {
            text: 'Your work, beautifully online.',
          }),
          el('p', 'text-lg text-base-content', {
            text: commerceEnabled
              ? 'Publish your pages, tell your story, and sell when you are ready — all from one place. This is your homepage; edit every word to make it yours.'
              : 'Publish your pages and tell your story — all from one place. This is your homepage; edit every word to make it yours.',
          }),
          el('div', 'mt-2 flex flex-wrap items-center justify-center gap-3', {
            children: [
              ...(commerceEnabled
                ? [
                    el('a', 'btn btn-primary btn-lg', {
                      attrs: { href: '/shop' },
                      text: 'Browse the shop',
                    }),
                  ]
                : []),
              el(
                'a',
                commerceEnabled ? 'btn btn-neutral btn-outline btn-lg' : 'btn btn-primary btn-lg',
                {
                  attrs: { href: '/about' },
                  text: 'Learn more',
                }
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A closing call-to-action band. Neutral: works whether the next step is adding a
 *  product, writing a post, or inviting a teammate. */
function ctaBand(): Node {
  return el('section', 'bg-primary px-6 py-16 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-4', {
        children: [
          el('h2', 'text-3xl font-bold text-primary-content', { text: 'Ready when you are.' }),
          el('p', 'text-lg text-primary-content/80', {
            text: 'Add a product, publish a page, or invite your team — start with whatever comes first.',
          }),
          el('a', 'btn btn-lg mt-2 bg-base-100 text-base-content', {
            attrs: { href: '/contact' },
            text: 'Get in touch',
          }),
        ],
      }),
    ],
  });
}

/** A three-up value row for the About page — authored cards (silica's shipped
 *  featureGrid rendered empty), neutral labels a tenant edits. */
function featureTrio(): Node {
  const card = (title: string, body: string): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-semibold text-base-content', { text: title }),
        el('p', 'text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 px-6 py-16', {
    children: [
      el('div', 'mx-auto max-w-5xl', {
        children: [
          el('h2', 'mb-8 text-2xl font-semibold text-base-content', {
            text: 'What you can do here',
          }),
          el('div', 'grid gap-6 sm:grid-cols-3', {
            children: [
              card(
                'Publish',
                'Create pages and posts that look right on every screen — no code needed.'
              ),
              card(
                'Sell',
                'Add products and take orders whenever selling becomes part of the plan.'
              ),
              card(
                'Grow',
                'Reach your audience with email, and understand what is working over time.'
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The About page editorial body — a real, editable starting narrative (no eyebrow
 *  kicker), sized for comfortable reading. */
function aboutContent(): Node {
  return el('section', 'bg-base-100 px-6 py-16', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content', {
            text: 'About us',
          }),
          el('p', 'text-lg text-base-content', {
            text: 'This is your story — who you are, what you make, and why it matters. Replace this text with a few honest sentences about your work; the people who find you here want to know the human behind it.',
          }),
          el('p', 'text-lg text-base-content', {
            text: 'You can add sections, images, and links from the builder. When you are ready, connect a shop, a blog, or a contact form — this page grows with you.',
          }),
        ],
      }),
    ],
  });
}

/** The Contact page — a simple, editable prompt (no live form yet; the form node
 *  lands with the commerce/forms migration). */
function contactContent(): Node {
  return el('section', 'bg-base-100 px-6 py-16 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-xl flex-col items-center gap-4', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content', { text: 'Get in touch' }),
          el('p', 'text-lg text-base-content', {
            text: 'Have a question or want to work together? Tell visitors the best way to reach you — an email, a phone number, or a form you add from the builder.',
          }),
          el('a', 'btn btn-primary btn-lg mt-2', {
            attrs: { href: 'mailto:hello@example.com' },
            text: 'Email us',
          }),
        ],
      }),
    ],
  });
}

// ── Frame + pages ─────────────────────────────────────────────────────────────

/** The shared shell: the branded nav, a flex-grown main holding the single Outlet
 *  (every page body drops in here), and the branded footer. The `min-h-screen
 *  flex-col` column pins the footer to the bottom on short pages. The main carries
 *  id="st-main" so the storefront skip-link targets it. Exactly one Outlet. */
function frameRoot(opts: SiteChromeOptions = {}): Node {
  return el('div', 'flex min-h-screen flex-col bg-base-100', {
    children: [
      siteNavbar(opts),
      el('main', 'flex-1', { attrs: { id: 'st-main', tabindex: -1 }, children: [outlet()] }),
      siteFooter(opts),
    ],
  });
}

/** The starter frame — the shared branded header/footer chrome, fully stamped. */
export function starterFrame(opts: SiteChromeOptions = {}): Frame {
  return { root: stampTree(frameRoot(opts)), editable: true };
}

/** The starter pages, fully stamped. With Commerce active: Home merchandises
 *  (hero → product grid → featured rail → CTA), and Shop is the catalog grid.
 *  Without it, Home drops the commerce sections (hero → CTA only) and Shop is
 *  omitted entirely — a tenant with no Commerce module gets no page, nav link, or
 *  CTA that points at a store that doesn't exist. About is editorial + a value
 *  row; Contact is a reach-out prompt. Each is a `pageBody` so the Navigator shows
 *  a real "Page" root that holds sections as siblings. */
export function starterPages(opts: SiteChromeOptions = {}): Page[] {
  const { commerceEnabled = true, schedulingEnabled = false, cmsEnabled = false } = opts;
  const homeSections = commerceEnabled
    ? [hero(true), productGrid(), featuredProducts(), ctaBand()]
    : [hero(false), ctaBand()];
  return [
    makePage('Home', '/', stampTree(pageBody(homeSections))),
    ...(commerceEnabled
      ? [
          // Shop = the faceted PLP core (docs/127 §8) under an editable header, so the
          // shop-all page carries the same brand/type/tags/color/size facets + sort +
          // pagination as /products, not a bare truncated grid. The core reads the URL for
          // its filter state; the route renders it through the functional walk.
          makePage(
            'Shop',
            '/shop',
            stampTree(pageBody([shopHeader(), hostCore(HOST_KEYS.commercePlp)]))
          ),
          // The cart is a FUNCTIONAL page (docs/122): an editable shell wrapping the
          // pinned `commerce.cart` core. Seeded so a commerce tenant's studio lists a
          // "Cart" page they can restyle/surround — the core stays put (locked: "host").
          // Not linked in nav (the mini-cart reaches it); it's here to be editable.
          makePage(
            'Cart',
            '/cart',
            stampTree(pageBody([functionalShell(HOST_KEYS.commerceCart, { heading: 'Your cart' })]))
          ),
          // Search — an editable shell around the pinned `commerce.search` core. Seeded
          // so the studio lists an editable "Search" page; not in nav (the header search
          // field reaches it).
          makePage(
            'Search',
            '/search',
            stampTree(pageBody([functionalShell(HOST_KEYS.commerceSearch, { heading: 'Search' })]))
          ),
          // Products (PLP) — an editable shell around the pinned `commerce.plp` catalog
          // core. No shell heading: the listing's heading is query-dependent, so the core
          // renders it. This is the "Shop all" faceted catalog the nav points at.
          makePage(
            'Products',
            '/products',
            stampTree(pageBody([functionalShell(HOST_KEYS.commercePlp)]))
          ),
          // Collections index — an editable shell around the pinned `commerce.collections`
          // grid core (the core renders its own header/subtitle).
          makePage(
            'Collections',
            '/collections',
            stampTree(pageBody([functionalShell(HOST_KEYS.commerceCollections)]))
          ),
          // Categories index — an editable shell around the pinned `commerce.categories`
          // browse-tree grid core (the core renders its own header/subtitle).
          makePage(
            'Categories',
            '/category',
            stampTree(pageBody([functionalShell(HOST_KEYS.commerceCategories)]))
          ),
          // The public account AUTH pages (docs/122) — each an editable shell around the
          // ONE pinned `commerce.auth` core, distinguished by the baked `mode` prop the
          // route/composite sets (not author-tunable). Seeded so the studio lists a real
          // "Login"/"Register"/… page a tenant can brand; the authed account cluster
          // (orders/wishlist/…) is a separate surface. Commerce-gated (shopper accounts
          // are a commerce concern, matching the footer's Account links).
          makePage(
            'Login',
            '/account/login',
            stampTree(
              pageBody([functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'signin' } })])
            )
          ),
          makePage(
            'Register',
            '/account/register',
            stampTree(
              pageBody([functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'register' } })])
            )
          ),
          makePage(
            'Forgot password',
            '/account/forgot',
            stampTree(
              pageBody([functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'forgot' } })])
            )
          ),
          makePage(
            'Reset password',
            '/account/reset',
            stampTree(
              pageBody([functionalShell(HOST_KEYS.commerceAuth, { props: { mode: 'reset' } })])
            )
          ),
        ]
      : []),
    // Book — an editable shell around the pinned `scheduling.services` core (docs/122),
    // seeded only for a tenant with the Scheduling module active. No shell heading: the
    // services list core renders its own header + subtitle. The bookable-service DETAIL
    // (/book/[serviceId], the live time-picker) is a per-record template on the same
    // pinned-core path once services get a stored silica template.
    ...(schedulingEnabled
      ? [
          makePage(
            'Book',
            '/book',
            stampTree(pageBody([functionalShell(HOST_KEYS.schedulingServices)]))
          ),
        ]
      : []),
    // Journal — the blog INDEX, seeded only for a tenant with the CMS module active.
    // The per-post DETAIL page is not seeded here: it is a record template, so it comes
    // from the `cms.blog_post` code composite (`starterCollectionDto`) like the PDP,
    // which reaches every tenant instead of only ones created after this shipped.
    ...(cmsEnabled ? [makePage('Journal', '/blog', stampTree(blogIndexPage()))] : []),
    makePage('About', '/about', stampTree(pageBody([aboutContent(), featureTrio()]))),
    makePage('Contact', '/contact', stampTree(pageBody([contactContent()]))),
  ];
}

/** The complete silica-native starter `Site` — shared branded frame + starter pages
 *  in the tenant's theme. Pass the tenant's compiled silica `Theme`
 *  (`compiledToSilicaTheme` of its brand) so the seed previews/renders in the real
 *  brand; falls back to a shipped preset when none is supplied. `commerceEnabled`
 *  (default `true`, so every existing caller/test is unaffected) strips every
 *  Shop-flavored page/link/CTA for a tenant with no Commerce module active. */
export function starterSite(theme: Theme = THEME_PRESETS[0]!, opts: SiteChromeOptions = {}): Site {
  return {
    version: '1.0.0',
    theme,
    frame: starterFrame(opts),
    pages: starterPages(opts),
  };
}
