// The silica authoring guide an AI agent reads BEFORE it writes a page (docs/118).
//
// `/builder/studio` — the real dashboard editor — is built on
// `@wizeworks/silicaui-builder`, a framework-neutral node-tree engine. A site is
// ONE `Site { version, theme, frame?, pages, symbols? }`: `pages` are routable
// bodies, `frame` is the shared chrome (navbar/Outlet/footer) every page renders
// through, `theme` is the token set, `symbols` are the author's saved
// components. This object is the contract for authoring that shape by hand via
// the silica MCP tools — surfaced by `describe_silica_authoring`.
//
// Kept faithful to the SOURCES it documents: the authoring kit + block catalog in
// `@wizeworks/silicaui-html`, the sparx domain composites in
// `@sparx/silica-catalog`, and the reconcile contract in
// `packages/builder/src/services/site-service.ts`. When those change, change this.

export const SILICA_STYLE_GUIDE = {
  overview:
    'Author a site as a tree of silica Nodes: { kind:"element", tag, class, children, data? } for raw HTML, or ' +
    '{ kind:"component", component, class, props, children } for a @wizeworks/silicaui component. `upsert_silica_page` ' +
    'takes ONLY the page-body CHILDREN (an array of Nodes) — never the outer page wrapper and never ids; the service ' +
    'wraps and stamps them. Compose pages from real, pre-built material rather than inventing markup from scratch: ' +
    "fetch a silica-native BLOCK (get_silica_block) or a sparx domain COMPOSITE (from list_silica_blocks' sparx group) " +
    'and edit its text/props/hrefs in place — every block is already responsive, themed, and allowlist-safe. ' +
    'NON-NEGOTIABLE: every page — and especially the frame — MUST work at phone width; blocks already satisfy this, so ' +
    "preserve their layout classes when you edit copy, don't replace them with a fixed-width arrangement.",

  authoringKit: {
    description:
      "Only reach for these when composing something a block doesn't already cover (a bespoke section, gluing two " +
      'blocks together, small inline tweaks). Import surface: @wizeworks/silicaui-html.',
    el: 'el(tag, class?, { text?, attrs?, children? }) — a raw element node. `text` is sugar for a single string child.',
    atom: 'atom(component, class?, props?, children?) — a @wizeworks/silicaui component node (e.g. "Button", "Badge").',
    outlet:
      'outlet() — the reserved marker for where the routed page renders. Valid ONLY inside a frame; a page body must ' +
      'never contain one.',
    bind:
      "bind(node, ref) — resolves `ref` into the node's primary content (an <img>/Image/Avatar gets `src`, a node " +
      'with a `label` prop gets its label, everything else gets its text).',
    repeat:
      "repeat(node, ref) — marks a CONTAINER to render once per item of a collection `ref` (e.g. a product grid's " +
      "card template). Children render once per item with the item's own fields in scope.",
    action:
      'action(node, ref, href?) — marks a node (usually a <form> or a button/link) as a host-action trigger (e.g. ' +
      '"add-to-cart", "contact", "email-signup"). Inert until the storefront\'s behavior runtime wires it — never ' +
      'invent a new action ref; reuse one a block already ships (see `forms` below).',
    behave:
      'behave(node, marker) — marks a node as the ROOT of an interactive behavior (carousel, tabs, accordion, ' +
      'disclosure, menu, modal, marquee, scrollspy, theme-toggle, form). Blocks that need one already carry it — you ' +
      'rarely author this by hand.',
  },

  pageAuthoring: {
    description:
      'A page is identified by { id?, name, slug }; its content is `sections: Node[]` — the top-level siblings under ' +
      'the page body (NOT a single wrapping root). Omit `id` on upsert_silica_page to CREATE a page (a fresh id is ' +
      "returned); pass an existing `id` to REPLACE that page's content. A slugless page (empty string) is the site " +
      'home ("/"). SEO (title/description/canonical/OG/noindex) and collection-template targeting (recordType/isDefault) ' +
      'are a SEPARATE side-channel — see `metadata` below; never put them in `sections`.',
    homeFirst:
      "A silica Site always needs at least one page (silica's own schema requires it — pages[0] is the home/default). " +
      'On a brand-new or freshly-reset property, upsert_silica_page for the HOME page FIRST — set_silica_frame and ' +
      'set_silica_theme both need at least one page to attach to and will error with a clear message otherwise.',
    example: {
      name: 'About',
      slug: 'about',
      sections: [
        {
          kind: 'element',
          tag: 'section',
          class: 'w-full bg-base-100 px-6 py-20',
          children: [
            {
              kind: 'element',
              tag: 'div',
              class: 'mx-auto flex max-w-2xl flex-col items-center gap-4 text-center',
              children: [
                {
                  kind: 'element',
                  tag: 'h1',
                  class: 'text-4xl font-semibold',
                  children: ['About the studio'],
                },
                {
                  kind: 'element',
                  tag: 'p',
                  class: 'text-lg text-base-content/80',
                  children: ['A few sentences on who we are and why we make things by hand.'],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  blocksVsComposites: {
    description:
      "Two catalogs, merged in list_silica_blocks / get_silica_block: silica's own NATIVE blocks (marketing/content " +
      'patterns — hero, feature grid, testimonials, pricing, team, stats, FAQ, contact form, nav/footer chrome) and ' +
      "sparx's domain COMPOSITES (@sparx/silica-catalog — commerce/content patterns silica has no concept of: product " +
      'grid/card, buy box, featured products, collection header, the sparx-branded navbar/footer). Prefer a native ' +
      'block for anything generic; reach for a sparx composite only when the section needs real commerce/CMS data.',
    nativeBlocks: [
      'heroSplitCta',
      'faqAccordion',
      'featureGrid',
      'navbar',
      'footer',
      'ctaBand',
      'testimonialQuote',
      'testimonialsGrid',
      'pricingTiers',
      'statsBand',
      'logoCloud',
      'teamGrid',
      'contactSection',
      'contentProse',
      'featureMedia',
      'tabs',
      'accordion',
      'dropdown',
    ],
    sparxComposites: [
      'productGrid — a responsive grid of product cards, bound to commerce.product (or a collection-scoped source).',
      'productCard — one product tile (image, title, price); usually used INSIDE productGrid, not standalone.',
      'featuredProducts — a curated rail, e.g. for a homepage "Featured" section.',
      'buyBox — the PDP add-to-cart form (variant picker + quantity + submit); pre-wired to the cart end to end.',
      "collectionHeader — a collection/category page's title + description band, bound to the in-scope record.",
      'siteNavbar / siteFooter — sparx-branded chrome (bound to site.identity/site.social); prefer these over the ' +
        'native navbar/footer blocks for the FRAME so the wordmark/social links resolve per-tenant automatically.',
    ],
    forms:
      "There is NO sparx-authored form composite — use silica's native `contactSection` block as-is for a contact " +
      'page. It is pre-wired end to end (the "contact" action ref is already handled by the storefront\'s behavior ' +
      'runtime + the CMS-backed form-submission pipeline); do not build a new form from raw elements.',
  },

  binding: {
    description:
      "A node's `data` marker (set by `bind`/`repeat`/`action`) carries an opaque `ref` the storefront host resolves " +
      'against live data. Cardinality: a COLLECTION ref on a container (`repeat`) renders once per item, with the ' +
      "item's own fields in scope; a VALUE ref (`bind`) fills one node's content. Inside an item scope, use the " +
      "field's own short key (`title`, `price`), not `item.title` — the resolver already scopes it.",
    sources: [
      "commerce.product / commerce.collection — the tenant's catalog.",
      "cms.<type> — a CMS content type's entries, e.g. cms.blog_post.",
      'site.identity — name/logo (Wordmark/Logo-style nodes).',
      'site.social — social links (SocialLinks-style nodes).',
    ],
    collectionTemplates:
      'A page with `recordType` set (via set_page_record_type) is a COLLECTION TEMPLATE — the record of that type is ' +
      "injected as the object scope (e.g. commerce.product → the current product's fields are directly bound, no " +
      '`item.` prefix). productDetailPage-style composites assume this.',
  },

  theme: {
    description:
      'A silica Theme is { name, tokens, dark?, mode? } — `tokens`/`dark` are `--`-prefixed CSS custom-property maps ' +
      '(color roles + their `-content` on-color pairs, radius, spacing) applied verbatim, not a preset key. ' +
      "get_silica_theme returns the CURRENT theme (author-saved if one exists, else the tenant's brand-derived " +
      'default is what the editor previews — an unset theme is intentional, not a gap). set_silica_theme REPLACES the ' +
      'whole theme object; pass every token you want to keep, not just the ones changing.',
    savedThemes:
      "Optionally maintain a small library of alternate themes via set_silica_theme's `savedThemes` (an array of full " +
      'Theme objects) — authoring convenience only, never rendered on the live storefront (only the active `theme` is).',
  },

  frame: {
    description:
      'The FRAME is the shared chrome — navbar ⊕ Outlet ⊕ footer — every page renders through. set_silica_frame ' +
      'REPLACES it entirely (pages/theme/symbols untouched). The frame tree MUST contain exactly one Outlet node ' +
      "(from the authoring kit's `outlet()`, or copy the outlet placement from get_silica_frame's current tree) — a " +
      'frame missing it renders chrome with no page body.',
    identity:
      'Bind the brand mark to the platform-owned site data via siteNavbar/siteFooter (sparx composites, bound to ' +
      'site.identity/site.social automatically) rather than a hand-bound native navbar/footer block.',
  },

  metadata: {
    description:
      'SEO and collection-template targeting live on the sparx BuilderPage row, not the silica tree — set them via ' +
      'these EXISTING legacy-surface tools (they work identically on a silica-materialized page, since a silica page ' +
      'id IS the row id): set_page_seo (pageId + seoTitle/seoDescription/canonical/ogImage/noindex — omit a field to ' +
      'leave it, empty string clears it), set_page_record_type (pageId, recordType — makes a page a collection ' +
      'template, e.g. "commerce.product" or "cms.blog_post"), set_page_default (pageId — this template becomes the ' +
      "type's default when no per-record override exists). Never pass these through upsert_silica_page.",
  },

  lifecycle: {
    description:
      'Every write (upsert_silica_page, delete_silica_page, set_silica_frame, set_silica_theme, plus set_page_seo / ' +
      'set_page_record_type / set_page_default) saves to DRAFT. Nothing is live until publish_silica_site ' +
      '(confirmation-gated) snapshots every draft — pages, frame, theme, symbols — to its published counterpart in ' +
      'one call. reset_silica_site (confirmation-gated, DESTRUCTIVE) discards all silica-materialized pages/frame/' +
      'symbols and starts clean; the authored theme survives a reset.',
  },

  workflow:
    'Typical loop: (1) describe_silica_authoring once to load this guide. (2) list_silica_pages to see what exists; ' +
    'get_silica_page / get_silica_frame / get_silica_theme to read current content. (3) On a fresh site: ' +
    'upsert_silica_page for the home page FIRST, then set_silica_frame + set_silica_theme, then the remaining pages. ' +
    '(4) For each page, browse list_silica_blocks and pull real content via get_silica_block rather than freehand ' +
    'markup, then set_page_seo / set_page_record_type / set_page_default as needed. (5) publish_silica_site to take ' +
    'the whole site live. (6) Verify by opening /builder/studio in the real editor — the MCP tools bypass its React ' +
    'engine entirely, so a persistence-layer success is not proof the editor itself renders it cleanly.',
} as const;

export type SilicaStyleGuide = typeof SILICA_STYLE_GUIDE;
