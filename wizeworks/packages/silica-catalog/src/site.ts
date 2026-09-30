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
import { featuredCarousel, productGrid, shopHeader } from './commerce';
import { HOST_KEYS, functionalShell, hostCore } from './host-nodes';
import {
  RECORD_ADDRESSES,
  RECORD_TEMPLATES,
  RECORD_TEMPLATE_LABELS,
  type RecordAddress,
} from './record-templates';
import { boundContactAction } from './sections/_contact-fields';
import { siteFooter, siteNavbar, type SiteChromeOptions } from './site-chrome';

// ── Page content (sparx-authored, neutral copy) ──────────────────────────────

/** A centered text hero — no image (so no broken-placeholder), neutral copy that
 *  fits a publisher, a shop, or both. The owner edits the words in place. A
 *  Commerce-less tenant gets no "Browse the shop" CTA (there's no `/shop` page
 *  to send visitors to — see `starterPages`).
 *
 *  ── IT IS ADDRESSED TO THE VISITOR, BECAUSE THE VISITOR IS WHO READS IT ──────
 *
 *  This used to read "Your work, beautifully online." over "This is your homepage;
 *  edit every word to make it yours." Both sentences speak to the OWNER, and this
 *  tree is the fallback `wizeworks/apps/site` serves on any site that has published
 *  nothing — so those were the platform's instructions to her, printed on a public
 *  web page for her customers, under her business's name in the navbar.
 *
 *  Found on Juniper Row's Trade site, which she had never opened: a stranger got a
 *  headline telling them to edit their homepage, above her real clothes at her real
 *  prices with a working Add to cart. 35 sites on that database were in the same
 *  state (issue 851).
 *
 *  So the words are the business talking to whoever arrived, which is what a
 *  homepage is. They stay neutral — no trade assumed, nothing claimed about a
 *  business the platform knows nothing about — and the name above them is already
 *  hers, because the navbar's brand is the live `site.brand` host core. Telling her
 *  the page is editable is the CONSOLE's job, and the publish pane now does it. */
function hero(commerceEnabled: boolean): Node {
  return el('section', 'bg-base-100 @container px-6 py-20 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Welcome.',
          }),
          el('p', 'text-lg text-base-content', {
            text: commerceEnabled
              ? 'Thanks for stopping by. Have a look around the shop, and get in touch if there is anything you would like to ask.'
              : 'Thanks for stopping by. Have a look around, and get in touch if there is anything you would like to ask.',
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

/** A closing call-to-action band, in the business's voice — see `hero` for why every
 *  word on this page is addressed to the VISITOR. It said "Ready when you are." over
 *  "Add a product, publish a page, or invite your team", which is the console's
 *  first-run checklist printed on a public home page (issue 851). */
function ctaBand(): Node {
  return el('section', 'bg-primary @container px-6 py-16 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col items-center gap-4', {
        children: [
          el('h2', 'text-3xl font-bold text-primary-content', { text: 'Come and say hello.' }),
          el('p', 'text-lg text-primary-content/80', {
            text: 'If you have a question, or you just want to know more, we would love to hear from you.',
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
 *  featureGrid rendered empty), neutral labels a tenant edits.
 *
 *  These read "What you can do here · Publish · Sell · Grow", which is PIGGLES'
 *  feature list, on a clothes maker's About page, under her name. A customer read it
 *  as Juniper Row offering to build them a website (issue 851). They are three plain
 *  things any business can say about itself now, and she replaces them with hers. */
function featureTrio(): Node {
  const card = (title: string, body: string): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-semibold text-base-content', { text: title }),
        el('p', 'text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto max-w-5xl', {
        children: [
          el('h2', 'mb-8 text-2xl font-semibold text-base-content', {
            text: 'How we work',
          }),
          el('div', 'grid gap-6 @2xl:grid-cols-3', {
            children: [
              card(
                'Carefully',
                'We would rather take the time and get it right than rush it and hope.'
              ),
              card(
                'In plain words',
                'Clear prices and straight answers. You will always know where things stand.'
              ),
              card('With real people', 'Ask us anything. Every message is read and answered.'),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The About page editorial body — a real, editable starting narrative (no eyebrow
 *  kicker), sized for comfortable reading.
 *
 *  It said "Replace this text with a few honest sentences about your work" and "You
 *  can add sections, images, and links from the builder". Two instructions to the
 *  owner, on her live About page, naming a tool her customers have no access to
 *  (issue 851). It is now two plain paragraphs in the business's own voice: generic,
 *  but nothing she would be embarrassed to have up for a week. */
function aboutContent(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex max-w-2xl flex-col gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content', {
            text: 'About us',
          }),
          el('p', 'text-lg text-base-content', {
            text: 'We are a small business, doing one thing and trying to do it properly. It started as something we cared about, and it grew from there.',
          }),
          el('p', 'text-lg text-base-content', {
            text: 'If you would like to know more about us, or about anything here, please get in touch. A real person answers every message.',
          }),
        ],
      }),
    ],
  });
}

/** The Contact page — a simple, editable prompt (no live form yet; the form node
 *  lands with the commerce/forms migration). */
function contactContent(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 text-center', {
    children: [
      el('div', 'mx-auto flex max-w-xl flex-col items-center gap-4', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content', { text: 'Get in touch' }),
          // Addressed to the visitor. It read "Tell visitors the best way to reach
          // you: an email, a phone number, or a form you add from the builder",
          // which is a note to the owner shown to the person trying to reach her
          // (issue 851). No channel is promised in the words, because the button
          // below hides itself until she has given one.
          el('p', 'text-lg text-base-content', {
            text: 'We would be glad to hear from you. A question, an order, or something you cannot find: whatever it is, a real person will answer.',
          }),
          // Bound, never a literal address: this button shipped pointing at
          // `mailto:hello@example.com`, on a starter page that LOOKS finished
          // (issue 265). It hides itself until the business has typed an email.
          boundContactAction('email', 'btn btn-primary btn-lg mt-2', 'Email us'),
        ],
      }),
    ],
  });
}

// ── Frame + pages ─────────────────────────────────────────────────────────────

/** The shared shell: the branded nav, a flex-grown main holding the single Outlet
 *  (every page body drops in here), and the branded footer. The `min-h-screen
 *  flex-col` column pins the footer to the bottom on short pages. The main carries
 *  id="st-main" so the storefront skip-link targets it. Exactly one Outlet.
 *
 *  That id keeps its `st-` spelling deliberately, and is the ONE survivor of the
 *  retirement (docs/implementation/st-token-retirement.md): it is an HTML anchor,
 *  not a class or a token, and a tenant may already have authored a skip link
 *  pointing at `#st-main`. Renaming it would break that silently for no gain.
 *
 *  `@container` on the `<main>` is the backstop for the whole responsive
 *  vocabulary: a page body drops into the Outlet, and an author who writes
 *  `@2xl:grid-cols-2` on a section they added themselves needs SOME ancestor
 *  declaring a query container or the class resolves against nothing and does
 *  silently nothing. The seeded sections each declare their own (nearest wins, and
 *  both are full-bleed, so the two agree); this covers everything else. */
function frameRoot(opts: SiteChromeOptions = {}): Node {
  return el('div', 'flex min-h-screen flex-col bg-base-100', {
    children: [
      siteNavbar(opts),
      el('main', 'flex-1 @container', {
        attrs: { id: 'st-main', tabindex: -1 },
        children: [outlet()],
      }),
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
    ? [hero(true), productGrid(), featuredCarousel(), ctaBand()]
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
    // The per-post DETAIL page is not here because it is not an ORDINARY page: it lives
    // at a record address (`/blog/:slug`) and is seeded by `recordPages` below, which
    // `starterSite` composes in. Keeping the two lists apart is deliberate — see the
    // note on `recordPages`.
    ...(cmsEnabled ? [makePage('Journal', '/blog', stampTree(blogIndexPage()))] : []),
    makePage('About', '/about', stampTree(pageBody([aboutContent(), featureTrio()]))),
    makePage('Contact', '/contact', stampTree(pageBody([contactContent()]))),
  ];
}

/** One record detail page as a silica `Page`: the code-authored template at its address,
 *  stamped and ready to edit like anything else in the switcher. */
export function recordPage(address: RecordAddress): Page {
  return makePage(
    RECORD_TEMPLATE_LABELS[address.recordType],
    address.slug,
    stampTree(RECORD_TEMPLATES[address.recordType]())
  );
}

/**
 * Every record detail page a site with these modules should have.
 *
 * SEPARATE FROM `starterPages`, ON PURPOSE — twice over. `starterPages` means "the
 * ordinary pages a new site opens with", and `starter-binds.test.ts` tests exactly that
 * meaning: no starter page binds at its root, because an ordinary page is not scoped to
 * one record. A record template legitimately IS, so folding these in would make that
 * suite fail for being correct. And the two lists have different lifecycles — an existing
 * property gets these backfilled by `ensureRecordPagesTx` long after its starter pages
 * were written.
 *
 * Module-gated by `RecordAddress.module`, so a publisher with no Commerce module never
 * sees a product page in their switcher — the same courtesy `starterPages` already
 * extends to Shop and Cart.
 */
export function recordPages(opts: SiteChromeOptions = {}): Page[] {
  const { commerceEnabled = true, schedulingEnabled = false, cmsEnabled = false } = opts;
  const active = { commerce: commerceEnabled, scheduling: schedulingEnabled, cms: cmsEnabled };
  return RECORD_ADDRESSES.filter((a) => active[a.module]).map(recordPage);
}

/** The complete silica-native starter `Site` — shared branded frame + starter pages
 *  in the tenant's theme. Pass the tenant's compiled silica `Theme`
 *  (`compiledToSilicaTheme` of its brand) so the seed previews/renders in the real
 *  brand; falls back to a shipped preset when none is supplied. `commerceEnabled`
 *  (default `true`, so every existing caller/test is unaffected) strips every
 *  Shop-flavored page/link/CTA for a tenant with no Commerce module active.
 *
 *  Record detail pages are APPENDED after the ordinary ones, so the switcher reads
 *  Home → Shop → … → About → Contact → Product detail → Blog post. Appending also keeps
 *  every existing page's position stable, which matters because both published readers
 *  tiebreak on `position asc`. */
export function starterSite(theme: Theme = THEME_PRESETS[0]!, opts: SiteChromeOptions = {}): Site {
  return {
    version: '1.0.0',
    theme,
    frame: starterFrame(opts),
    pages: [...starterPages(opts), ...recordPages(opts)],
  };
}
