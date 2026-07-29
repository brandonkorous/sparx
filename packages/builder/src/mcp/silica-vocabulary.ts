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
  // The canonical home of the design system this whole guide composes. Named so an
  // agent (or a developer reading a tool result) knows where the full component +
  // token reference lives beyond what these tools inline. The `silicaui` MCP server
  // (list_components / get_component / get_tokens) is the machine-readable form of
  // the same system; this guide is sparx's applied subset.
  designSystem:
    'Every node here composes @wizeworks/silicaui, WizeWorks’ open design system. Canonical reference: ' +
    'https://silicaui.com. The full component + token catalog is also available machine-readably via the separate ' +
    '`silicaui` MCP server (list_components, get_component, get_tokens) — connect it when you need a primitive or ' +
    'token this guide does not already inline.',

  overview:
    'Author a site as a tree of silica Nodes: { kind:"element", tag, class, children, data? } for raw HTML, or ' +
    '{ kind:"component", component, class, props, children } for a @wizeworks/silicaui component. `upsert_silica_page` ' +
    'takes ONLY the page-body CHILDREN (an array of Nodes) — never the outer page wrapper and never ids; the service ' +
    'wraps and stamps them. Compose pages from real, pre-built material rather than inventing markup from scratch: ' +
    "fetch a silica-native BLOCK (get_silica_block) or a sparx domain COMPOSITE (from list_silica_blocks' sparx group) " +
    'and edit its text/props/hrefs in place — every block is already responsive, themed, and allowlist-safe. ' +
    'NON-NEGOTIABLE: every page — and especially the frame — MUST work at phone width; blocks already satisfy this, so ' +
    "preserve their layout classes when you edit copy, don't replace them with a fixed-width arrangement.",

  responsive:
    'ONE RESPONSIVE VOCABULARY: CONTAINER QUERIES. Write `@2xl:grid-cols-3`, never `md:grid-cols-3`. A viewport ' +
    "variant (`sm:` `md:` `lg:` `xl:` `2xl:`) measures the browser WINDOW, and the human editor's phone/tablet " +
    "preview works by changing an ELEMENT's width — so a viewport variant renders correctly on the live site and is " +
    'frozen in the preview, which is how a broken mobile layout ships without anyone seeing it. The studio now ' +
    'REJECTS viewport variants at write time; upsert_silica_page returns them as `warnings` rather than refusing the ' +
    'save, so check that field. ' +
    'A container variant needs an ancestor carrying `@container` — every seeded section, the nav and the footer ' +
    'already do, and so does every native block. If you author a bare section of your own, put `@container` on it. ' +
    'THE FIVE STEPS ARE `@sm` (384px), `@md` (448), `@2xl` (672), `@3xl` (768), `@5xl` (1024) — nothing else emits ' +
    'CSS for spacing/type/flow, so do not invent `@4xl:py-20`. Translating a breakpoint you already have in mind: ' +
    '`sm`→`@2xl`, `md`→`@3xl`, `lg`→`@5xl`. `@5xl` is the top of the range (a full-bleed section caps its content ' +
    'with `max-w-*` long before that). Use `@sm`/`@md` when the thing you are sizing sits in a COLUMN rather than ' +
    'across the page — that is what they are for. ' +
    'Watch the one trap: `@container` makes an element a container for its CHILDREN. `@2xl:grid-cols-2` on the SAME ' +
    'element measures some ancestor instead, usually nothing. Container on the parent, variant on the child.',

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
                  class: 'text-lg text-base-content',
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
    // The REAL block keys, as `listBlocks()`/`getBlock()` key them — snake_case, and
    // `get_silica_block` takes them `native.`-prefixed (e.g. `native.hero_split_cta`).
    // Do NOT guess a camelCase name here: an unknown key is a hard BuilderNotFoundError,
    // and these strings ARE the contract an agent copies from.
    nativeBlocks: [
      'native.hero_split_cta — hero: copy + primary action beside an image.',
      'native.feature_grid — a grid that REPEATS over a collection ref.',
      'native.feature_media — one feature: copy + checklist beside an image. Ships an `eyebrow` slot.',
      'native.content_prose — titled long-form section, two body columns. Ships an `eyebrow` slot.',
      'native.cta_band — centered call-to-action band.',
      'native.stats_band — a row of headline metrics.',
      'native.testimonial_quote — one large centered quote.',
      'native.testimonials_grid — three-up testimonial cards.',
      'native.pricing_tiers — three-column pricing, featured middle plan.',
      'native.logo_cloud — social-proof wordmark strip.',
      'native.team_grid — team members with avatars.',
      'native.faq_accordion — Q/A disclosure list (behavior: disclosure).',
      'native.contact_section — copy + a WORKING validating form (behavior: form). See `forms` below.',
      'native.tabs / native.accordion / native.dropdown — interactive primitives.',
      'native.navbar / native.footer — AVOID for the frame: they hardcode "SilicaUI" demo branding. Use the sparx ' +
        'chrome composites (sparx.navbar / sparx.footer), which bind to the tenant’s own identity.',
    ],
    colorBands:
      'BUILD PAGES WITH RANGE, and know the two traps that punish it. A page built only from ' +
      '`bg-base-100` / `bg-base-200` reads as one flat surface — those two sit ~2% apart in lightness. Real rhythm ' +
      'comes from committing whole sections to a colour and swinging between them (e.g. `bg-neutral` → `bg-primary` ' +
      '→ `bg-base-100` → `bg-accent`), which costs nothing and needs no photography. ' +
      'TRAP 1 — always pair a background with its ON-COLOUR: `bg-neutral text-neutral-content`, ' +
      '`bg-primary text-primary-content`, `bg-accent text-accent-content`. A band with no paired ink inherits ' +
      'dark body text and the section becomes unreadable. ' +
      "TRAP 2 — HEADINGS DO NOT INHERIT THE BAND COLOUR. silicaui's theme layer sets " +
      '`:where(h1,h2,h3,h4,h5,h6){ color: var(--color-base-content) }`, so a heading inside a dark band renders ' +
      'DARK-ON-DARK and effectively disappears, even though the paragraph beside it is fine. Put the on-colour ' +
      'class on the heading ITSELF (`<h2 class="… text-neutral-content">`) every single time. This is the most ' +
      'common way an otherwise-correct dark section ships broken.',
    houseStyle:
      'sparx bans EYEBROWS (a small uppercase kicker label above a heading) — hierarchy is carried by scale/weight/' +
      'color. `native.content_prose` and `native.feature_media` ship an eyebrow node: DELETE it when you stamp them. ' +
      'Also banned: gradients as a visual device. Body text floors at 16px. ' +
      'FADED TEXT IS BANNED TOO, and this one bites on nearly every block: the native blocks ship subheads, stat ' +
      'labels, and captions as `text-base-content/70` (or /60, /50). Strip the opacity suffix when you stamp them — ' +
      '`text-base-content/70` becomes `text-base-content`. An opacity modifier is only for text NOT meant to be read; ' +
      'dimming real copy to signal hierarchy is the single most-repeated design defect on this platform. Carry ' +
      'hierarchy with size and weight, which the blocks already do.',
    sparxComposites: [
      'products — THE one configurable product listing. Repeats the product card over a chosen SOURCE, laid out as a ' +
        "grid or a rail. Source options (change the repeat's ref): `commerce.product` (whole catalog / shop-all grid), " +
        '`commerce.featured` (merchant-tagged, bounded), `commerce.new` (newest, bounded), `commerce.related` (same ' +
        'collection as the viewed product, bounded), `commerce.category.<collectionHandle>` (one category). The bounded ' +
        'sources are capped by the storefront and exclude the in-scope PDP product — NOT the whole catalog.',
      'productCard — one product tile (image, title, price); the reusable card `products` repeats, also usable ' +
        'standalone (pin it to one product). "Save as component" to fork a custom card.',
      'buyBox — the PDP add-to-cart form (variant picker + quantity + submit); pre-wired to the cart end to end.',
      "collectionHeader — a collection/category page's title + description band, bound to the in-scope record.",
      'siteNavbar / siteFooter — sparx-branded chrome (bound to site.identity/site.social); prefer these over the ' +
        'native navbar/footer blocks for the FRAME so the wordmark/social links resolve per-tenant automatically.',
    ],
    forms:
      "There is NO sparx-authored form composite — use silica's native `contact_section` block as-is for a contact " +
      'page. It is pre-wired end to end (the "contact" action ref is already handled by the storefront\'s behavior ' +
      'runtime + the CMS-backed form-submission pipeline); do not build a new form from raw elements.',
  },

  media: {
    description:
      'Images, video, audio, icons, and inline SVG all render (silica >= 0.21). The storefront projects a page body to ' +
      "HTML through silica's `toHtml`, whose sanitizer allows a fixed set of media tags/components and coerces " +
      'everything else to <div> (content lost). Author with the allowed tags/components below — do not reach for a ' +
      'raw <iframe>/<embed>/<object> (those still floor to <div>).',
    images:
      'An image is a raw element: { kind:"element", tag:"img", class:"<layout>", attrs:{ src, alt, loading:"lazy" } }. ' +
      'Allowed <img> attrs: src, alt, width, height, loading, decoding, srcset, sizes — plus `class` for sizing/fit ' +
      '(e.g. "w-full h-full rounded-box object-cover"). Put the img inside a sized wrapper (e.g. a div with ' +
      '`aspect-video overflow-hidden rounded-box`) so it crops cleanly.',
    src:
      'Two valid `src` forms: (1) an absolute https:// URL renders verbatim — an external/CDN/stock image (e.g. a ' +
      'Pexels photo) is a first-class, portable choice and bakes no environment-specific host into the tree; (2) a ' +
      'BOUND image — put a value ref on the <img> (bind(imgNode, "image")) and the host fills its `src` from live ' +
      "data (a product/collection/blog record's own image, resolved through the platform media resolver). Prefer a " +
      'binding for record imagery (product cards, PDP heroes) so it tracks the record; use a direct https URL for ' +
      'decorative/marketing imagery (page hero, about-story photo, section art). Never hardcode a ' +
      '`/v1/public/media/<id>` URL — that is env-specific; bind instead.',
    video:
      'Self-hosted / direct-URL video renders. Two forms: (1) the Video COMPONENT — ' +
      '{ kind:"component", component:"Video", class, props:{ src|sources:[{src,type}], poster, controls, autoplay, muted, ' +
      'loop, playsinline, preload, ratio } } — expands to a real <video> (multiple sources via `sources`, aspect via ' +
      '`ratio` e.g. "16:9"); (2) a raw <video> element (allowed attrs: src, poster, controls, autoplay, loop, muted, ' +
      'playsinline, preload, width, height, crossorigin) with <source> children (src/type/media/srcset/sizes). For a ' +
      'muted looping hero-background video, seed controls:false, autoplay:true, muted:true, loop:true, playsinline:true ' +
      'and ALWAYS set a `poster` still (first paint + no-autoplay fallback). <audio> renders the same way ' +
      '(src/controls/autoplay/loop/muted/preload/crossorigin).',
    embed:
      'A third-party player/map (YouTube, Vimeo, Google Maps) uses the Embed COMPONENT — ' +
      '{ kind:"component", component:"Embed", class, props:{ url, title, ratio } }. It is the ONLY sanctioned <iframe>: ' +
      'silica normalizes `url` to the provider embed URL and emits a sandboxed, lazy iframe; an unrecognized host ' +
      'falls back to a plain link (never a raw iframe). A hand-authored <iframe> element still floors to <div> — use ' +
      'Embed instead.',
    icons:
      'The Icon COMPONENT — { kind:"component", component:"Icon", props:{ name:"<icon-name>" } } — resolves to an ' +
      'inline SVG in `toHtml` (no client runtime needed; visible on the static storefront as of 0.21). CRITICAL: the ' +
      "name must be one of silicaui's CURATED lucide set (~117 glyphs, NOT full lucide) — a name outside it renders " +
      'as an EMPTY span (silently invisible, the same failure mode the whole feature just fixed). Verified-present ' +
      'names include: sparkles, box, image, gallery, star, pencil, map-pin, calendar, clock, mail, phone, globe, ' +
      'shield, zap, heart, check-circle, info, search, arrow-right, arrow-left, external-link, user, users, lock, ' +
      'play, video, download, upload, send, settings, grid, list, plus. (palette/package/printer/pen-tool are NOT in ' +
      'the set.) Size/color it with utility classes on the component `class` (e.g. "h-6 w-6 text-primary"); the SVG ' +
      'inherits `currentColor`, so a `text-<token>` class tints it.',
    allowedTags:
      'Renderable media tags/components: img, picture, source, figure, figcaption, video, audio, a broad inline-svg ' +
      'subset (svg/g/defs/symbol/use/path/circle/ellipse/rect/line/polygon/polyline/text/tspan/clipPath/mask/pattern/' +
      'linearGradient/radialGradient/stop/image), and the Video/Embed/Icon/RichText components. Blocks with a media ' +
      'slot (heroSplitCta, featureMedia) already emit a correct <img>.',
    richText:
      'Long-form CMS HTML (a blog body) renders through the RichText COMPONENT — { kind:"component", component:"RichText" } ' +
      '— a `.prose` container for TRUSTED, pre-sanitized rich text bound from a content record. Use it for ' +
      'record-driven article bodies rather than hand-splitting prose into paragraph nodes.',
  },

  binding: {
    description:
      "A node's `data` marker (set by `bind`/`repeat`/`action`) carries an opaque `ref` the storefront host resolves " +
      'against live data. Cardinality: a COLLECTION ref on a container (`repeat`) renders once per item, with the ' +
      "item's own fields in scope; a VALUE ref (`bind`) fills one node's content.",
    refsAreRootedPaths:
      'A ref is ALWAYS a path from the DATA ROOT, qualified by its source — `commerce.product.title`, ' +
      '`site.identity.logo`, `cms.blog_post.excerpt`. A bare field key (`title`, `logo`) is a ref FRAGMENT, not a ref: ' +
      'at the root it resolves against `root.title` — nothing — and a bound node whose value comes back empty replaces ' +
      'its authored content. That is the exact defect that blanked a tenant wordmark (the picker wrote `logo`). ' +
      'ALWAYS author the fully-qualified path. Inside a `repeat`, the resolver peels the source prefix and takes the ' +
      'first suffix that resolves, so the SAME qualified ref works in an item scope — which is why bare refs from ' +
      'older code-authored composites still function. That peel is BACK-COMPAT, not the contract: do not write new ' +
      'bare refs. An unresolvable ref is reported as `UnknownRef` + a diagnostic and KEEPS the authored content, ' +
      'rather than silently blanking (silicaui >= 0.24).',
    sources: [
      "commerce.product — the tenant's catalog (whole). Fields: id, handle, title, price, compareAtPrice, " +
        'description, image, images, sku, variantId, url.',
      'commerce.featured / commerce.new / commerce.related — BOUNDED product sources (capped, and the in-scope PDP ' +
        'product is excluded). "Featured" means products the tenant TAGGED `featured`.',
      'commerce.category.<collectionHandle> — one category, keyed by the collection HANDLE (kebab-case), not its id.',
      'commerce.collection / commerce.category — array sources; `collection` / `category` / `product` are the ' +
        'matching OBJECT sources used inside a record-scoped template.',
      'scheduling.service — bookable services (array); `service` is the object form.',
      "cms.<type> — a CMS content type's entries, e.g. cms.blog_post (array). `<type>` alone (e.g. blog_post) is the " +
        "single in-scope record on that type's collection template.",
      'site.identity — name / tagline / logo. site.social — social links (platform, url). Always supplied by the ' +
        'host; never tree-derived.',
    ],
    unfetchedSources:
      'The storefront only fetches sources it RECOGNIZES by walking the tree for refs (`collectSilicaSourceNeeds`): ' +
      'the `commerce.*`, `cms.*` roots above. `site.*` is always supplied. A ref outside that set is never loaded, so ' +
      'it can never resolve — invent no new source roots.',
    pagination:
      'An unbounded source is PAGED, not truncated: `commerce.product` and every `cms.<type>` render 24 records per ' +
      'page and the rest are reachable at `?page=2`. Alongside the array the host publishes ' +
      '`<source>Total` / `<source>Page` / `<source>Pages` / `<source>From` / `<source>To` / `<source>HasMore`, so a ' +
      'bind can say "Showing 25–48 of 137" without any extra fetch. To give visitors the LINKS, place the ' +
      '`site.pagination` host core under the grid rather than hand-authoring Previous/Next anchors. The core hides ' +
      'itself when everything fits on one page, and it owns what an authored pager cannot: building each URL while ' +
      'preserving the other query parameters, and the `rel="prev"/"next"` + `aria-current` semantics. (Conditional ' +
      'visibility itself is NO LONGER the obstacle — see `conditionalVisibility` — but a hand-rolled pager still has ' +
      'to get all of that right on every site.) Its `list` prop names which collection it drives and is only needed ' +
      'on a page carrying more than one paged list.',
    conditionalVisibility:
      'A node can be shown only when its data exists. Give it `data: { kind: "visible", ref }` and the engine drops ' +
      'the node AND its subtree whenever `ref` resolves to nothing — null, undefined, false, "" or an empty array. ' +
      'Note `0` counts as PRESENT, so a zero price or a zero count still renders. Add `negate: true` to invert it, ' +
      'which is how "Sold out" or "No results yet" is authored. A node carries ONE binding, so a value that must ' +
      'also be DISPLAYED goes on an inner node and the conditional wraps it — that is how the product page shows a ' +
      'was-price strikethrough only on an actual sale. Do not make the page ROOT conditional: a root that resolves ' +
      'to "drop" falls back to the unresolved tree, so nothing is hidden.',
    sortAndFilter:
      "A collection binding's `source` takes `sort` (newest | price-asc | price-desc | title-asc | title-desc) and " +
      '`tag` (show only products carrying that tag) alongside `from` / `id` / `limit`. Both are applied by the API, ' +
      'so `limit: 6, sort: "price-desc"` is the six most expensive products — NOT the first six re-ordered. Two ' +
      'repeaters over the same source with different sort/tag are two independent lists and both resolve.',
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
